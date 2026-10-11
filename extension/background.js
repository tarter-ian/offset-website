// Offset extension, background worker.
// The Offset site asks for services to be measured. For each one this opens the
// service in a tab, runs the counting script there, hands the counts back to
// the site and closes the tab.
//
// Two ways to ask:
//   measure-all  Every service at once, in background tabs the person never has
//                to look at. A service they are not signed in to is reported as
//                "signed-out" and its tab is closed.
//   measure      One service, in a tab brought to the front, so the person can
//                sign in. Counting starts once they have.

const SERVICES = {
  chatgpt: { url: 'https://chatgpt.com/', host: 'chatgpt.com', script: 'providers/chatgpt-usage.js' },
  claude: { url: 'https://claude.ai/new', host: 'claude.ai', script: 'providers/claude-usage.js' },
  youtube: { url: 'https://www.youtube.com/feed/history', host: 'www.youtube.com', script: 'providers/youtube-history.js' },
  gemini: { url: 'https://myactivity.google.com/product/gemini', host: 'myactivity.google.com', script: 'providers/gemini-activity.js' },
};

// Long enough for someone to sign in, including two-step checks.
const TIMEOUT_MS = 10 * 60 * 1000;

// Jobs are kept in session storage, keyed by the measuring tab's id, because
// Chrome stops this worker whenever it is idle (for example during a login).
const key = (tabId) => `job:${tabId}`;
const getJob = async (tabId) => (await chrome.storage.session.get(key(tabId)))[key(tabId)] ?? null;
const setJob = (tabId, job) => chrome.storage.session.set({ [key(tabId)]: job });
const dropJob = (tabId) => chrome.storage.session.remove(key(tabId));

async function finish(tabId, job, message, closeTab = true) {
  await dropJob(tabId);
  chrome.tabs.sendMessage(job.siteTabId, { ...message, requestId: job.requestId, service: job.service }).catch(() => {});
  if (closeTab) chrome.tabs.remove(tabId).catch(() => {});
  // A tab the person was working in goes back to the site; background ones never took the screen.
  if (job.front) chrome.tabs.update(job.siteTabId, { active: true }).catch(() => {});
}

async function start(service, front, requestId, siteTab) {
  const tab = await chrome.tabs.create({ url: SERVICES[service].url, active: front, windowId: siteTab.windowId });
  await setJob(tab.id, { service, front, requestId, siteTabId: siteTab.id, startedAt: Date.now() });
}

async function inject(tabId, job) {
  const target = { tabId };
  try {
    // Receives the counts inside the extension's own world and passes them here.
    await chrome.scripting.executeScript({ target, files: ['provider-relay.js'] });
    // The counting scripts report through window.Reclaim; give them one that talks to the relay.
    await chrome.scripting.executeScript({ target, world: 'MAIN', files: ['provider-shim.js'] });
    await chrome.scripting.executeScript({ target, world: 'MAIN', files: [SERVICES[job.service].script] });
  } catch (e) {
    // The tab moved on before the scripts landed. The next page load tries again.
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, change, tab) => {
  if (change.status !== 'complete') return;
  const job = await getJob(tabId);
  if (!job) return;
  if (Date.now() - job.startedAt > TIMEOUT_MS) {
    await finish(tabId, job, { type: 'error', error: 'timeout' });
    return;
  }
  // tab.url is only visible on the hosts this extension may read, so a login
  // page on another host shows up here as no url at all.
  const onService = !!tab.url && new URL(tab.url).host === SERVICES[job.service].host;
  if (onService) await inject(tabId, job);
  else if (!job.front) await finish(tabId, job, { type: 'error', error: 'signed-out' });
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const job = await getJob(tabId);
  if (job) await finish(tabId, job, { type: 'error', error: 'closed' }, false);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!sender.tab) return;

  // From the Offset site, through site-bridge.js.
  if (message.type === 'measure' || message.type === 'measure-all') {
    const all = message.type === 'measure-all';
    const wanted = all ? message.services || Object.keys(SERVICES) : [message.service];
    const services = wanted.filter((s) => Object.hasOwn(SERVICES, s));
    if (!services.length) {
      sendResponse({ ok: false, error: 'unknown-service' });
      return;
    }
    (async () => {
      for (const service of services) await start(service, !all, message.requestId, sender.tab);
      sendResponse({ ok: true, services });
    })();
    return true;
  }

  // From a measuring tab, through provider-relay.js.
  (async () => {
    const tabId = sender.tab.id;
    const job = await getJob(tabId);
    if (!job) return;
    if (message.type === 'done' && message.data && message.data.service === job.service) {
      await finish(tabId, job, { type: 'usage', usage: message.data });
    } else if (message.type === 'idle' && !job.front) {
      // The service's page loaded but counting never began: not signed in.
      await finish(tabId, job, { type: 'error', error: 'signed-out' });
    }
  })();
});
