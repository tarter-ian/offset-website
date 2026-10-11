# Offset browser extension

Measures how much a person uses ChatGPT, Claude, Gemini and YouTube, so the
site can work out their footprint from real numbers instead of an estimate.

The person installs it once. After that the site can ask it to measure, and it
does the rest: it opens each service in a background tab, counts the last 30
days there, hands the counts to the site and closes the tab. Only counts and
dates leave the service's page. No chat text, titles or video ids.

Chrome and Edge on computers only. It has no effect on phones.

## Try it

1. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**
   and choose this folder.
2. Run `node extension/demo/serve.mjs` and open <http://localhost:5173>.
3. Press **Measure my usage**.

After changing any file here, press the reload arrow on the extension's card in
`chrome://extensions`, then reload the page that talks to it.

## How the site talks to it

`site-bridge.js` runs on the site's own pages (the addresses under
`content_scripts.matches` in `manifest.json`) and relays `window.postMessage`
messages on the page's origin.

| Page sends (`source: 'offset-site'`) | Meaning |
| --- | --- |
| `{ type: 'ping' }` | Is the extension installed? |
| `{ type: 'measure-all', requestId, services? }` | Measure every service in background tabs. |
| `{ type: 'measure', service, requestId }` | Measure one service in a front tab, so the person can sign in. |

| Extension sends (`source: 'offset-extension'`) | Meaning |
| --- | --- |
| `{ type: 'ready', version }` | Installed. Sent on page load and in answer to `ping`. |
| `{ type: 'started', requestId, services }` | The tabs are open. |
| `{ type: 'usage', service, requestId, usage }` | One service's counts. |
| `{ type: 'error', service, requestId, error }` | `signed-out`, `closed`, `timeout` or `unavailable`. |

`demo/index.html` is a working example.

## What `usage` holds

Every service: `service`, `windowDays` (30), `collectedAt`, `activeDays`,
`daily[]`, `truncated`.

| Service | Also | `daily[]` items |
| --- | --- | --- |
| `chatgpt` | `prompts`, `reasoningResponses`, `images`, `conversations`, `planType` | `{ date, prompts, reasoning, images }` |
| `claude` | `prompts`, `reasoningResponses`, `toolCalls`, `conversations`, `rateLimitTier`, `weeklyLimitUsedPercent`, `fiveHourLimitUsedPercent` | `{ date, prompts, reasoning, toolCalls }` |
| `gemini` | `prompts` | `{ date, prompts }` |
| `youtube` | `videos`, `shorts`, `watchedHours`, `listedHours`, `cappedDays`, `undatedVideos` | `{ date, videos, shorts, hours, listedHours }` |

Things to know when using these numbers:

- Claude counts cover chats on claude.ai. Claude Code and other apps on the same
  plan appear only in `weeklyLimitUsedPercent`.
- Gemini counts items in Gemini Apps Activity, which the person must have turned
  on. Image and video requests are not told apart from chat.
- YouTube `hours` is video length times the share watched, from YouTube's own
  progress bar. YouTube marks many long videos as fully watched, so this runs
  high; each day is held to 24 hours and `cappedDays` says how many days hit
  that. Prefer the `videos` and `shorts` counts.
- The numbers are measured in the person's own browser. Nothing proves them.

## How it is put together

| File | Runs in | Job |
| --- | --- | --- |
| `background.js` | Extension worker | Opens the tabs, injects the scripts, returns the counts, closes the tabs. |
| `site-bridge.js` | The site's pages | Relays messages between the page and the worker. |
| `provider-shim.js` | The service's page | Gives the counting scripts the `window.Reclaim` they report through. |
| `provider-relay.js` | The service's tab | Passes the counts from the page to the worker. |
| `providers/*.js` | The service's page | One counting script per service. |

The counting scripts are the same ones registered as Reclaim providers, which is
why they report through `window.Reclaim`. They read endpoints and page data the
services do not document, so one can stop working when its service changes.

## Before it is released

- Add the site's final domain to `content_scripts.matches` in `manifest.json`.
- Add icons.
- Submit it to the Chrome Web Store.
