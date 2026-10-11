// Reclaim user script: YouTube watch history, last 30 days.
// After the person signs in, opens their history page, reads it back 30 days
// and counts videos, Shorts and hours watched per day. Only counts and dates
// leave the page; no titles, channels or video ids.
(function () {
  if (window.__offsetYoutubeHistory) return;
  window.__offsetYoutubeHistory = { started: false, done: false };
  var state = window.__offsetYoutubeHistory;

  var WINDOW_DAYS = 30;
  var MAX_PAGES = 120;
  var MAX_ITEMS = 20000;
  var HISTORY_URL = 'https://www.youtube.com/feed/history';

  var sleep = function (ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  };

  function banner(text) {
    var el = document.getElementById('offset-usage-banner');
    if (!el) {
      if (!document.body) return;
      el = document.createElement('div');
      el.id = 'offset-usage-banner';
      el.style.cssText =
        'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;padding:14px 16px;' +
        'background:#0f3d2e;color:#fff;font:15px/1.4 system-ui,sans-serif;text-align:center';
      document.body.appendChild(el);
    }
    el.textContent = text;
  }

  var loggedIn = function () {
    return !!(window.ytcfg && typeof window.ytcfg.get === 'function' && window.ytcfg.get('LOGGED_IN'));
  };

  var localDate = function (d) {
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };

  var normal = function (label) {
    return String(label).toLowerCase().replace(/\s+/g, ' ').trim();
  };

  // YouTube titles each day's section "Today", "Yesterday", a weekday, or a
  // date like "Oct 3", in the page's language. Build those labels for recent
  // days in that language and look the title up.
  function dayLabels() {
    var lang = document.documentElement.lang || navigator.language || 'en';
    var labels = {};
    var add = function (label, date) {
      var key = normal(label);
      if (key && !(key in labels)) labels[key] = date;
    };
    var fmt = function (opts) {
      try {
        return new Intl.DateTimeFormat(lang, opts);
      } catch (e) {
        return new Intl.DateTimeFormat('en', opts);
      }
    };
    var rel;
    try {
      rel = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
    } catch (e) {
      rel = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    }
    var weekday = fmt({ weekday: 'long' });
    var styles = [
      fmt({ month: 'short', day: 'numeric' }),
      fmt({ month: 'long', day: 'numeric' }),
      fmt({ month: 'short', day: 'numeric', year: 'numeric' }),
      fmt({ month: 'long', day: 'numeric', year: 'numeric' }),
    ];
    for (var back = 0; back <= WINDOW_DAYS + 60; back++) {
      var d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - back);
      var date = localDate(d);
      if (back <= 1) add(rel.format(-back, 'day'), date);
      if (back >= 1 && back <= 6) add(weekday.format(d), date);
      for (var i = 0; i < styles.length; i++) add(styles[i].format(d), date);
    }
    return labels;
  }

  // "1:11:30" or "4:05" to seconds; anything else (LIVE, SHORTS) to 0.
  function seconds(text) {
    var t = String(text || '').trim();
    if (!/^\d{1,2}(:\d{2}){1,2}$/.test(t)) return 0;
    return t.split(':').reduce(function (sum, n) { return sum * 60 + Number(n); }, 0);
  }

  function readVideo(lockup) {
    var overlays = (((lockup.contentImage || {}).thumbnailViewModel || {}).overlays) || [];
    var duration = 0;
    var percent = null;
    overlays.forEach(function (o) {
      var bottom = o.thumbnailBottomOverlayViewModel || o.thumbnailOverlayBadgeViewModel;
      if (!bottom) return;
      (bottom.badges || bottom.thumbnailBadges || []).forEach(function (b) {
        duration = duration || seconds((b.thumbnailBadgeViewModel || {}).text);
      });
      var bar = (bottom.progressBar || {}).thumbnailOverlayProgressBarViewModel;
      if (bar && typeof bar.startPercent === 'number') percent = bar.startPercent;
    });
    return { duration: duration, percent: percent };
  }

  // The older item shape, which YouTube still returns for some videos.
  function readOldVideo(video) {
    var percent = null;
    (video.thumbnailOverlays || []).forEach(function (o) {
      var resume = o.thumbnailOverlayResumePlaybackRenderer;
      if (resume && typeof resume.percentDurationWatched === 'number') percent = resume.percentDurationWatched;
    });
    return { duration: seconds((video.lengthText || {}).simpleText), percent: percent };
  }

  function sectionTitle(section) {
    var header = (section.header || {}).itemSectionHeaderRenderer;
    if (!header || !header.title) return '';
    return header.title.simpleText || (header.title.runs || []).map(function (r) { return r.text; }).join('');
  }

  // YouTube's own web client signs its requests with a hash of a cookie that
  // page scripts can read. The value is used here for same-site requests only.
  async function authHeader() {
    var m = document.cookie.match(/(?:^|;\s*)(?:SAPISID|__Secure-3PAPISID)=([^;]+)/);
    if (!m) return null;
    var ts = Math.floor(Date.now() / 1000);
    var bytes = new TextEncoder().encode(ts + ' ' + m[1] + ' ' + location.origin);
    var digest = await crypto.subtle.digest('SHA-1', bytes);
    var hex = Array.prototype.map
      .call(new Uint8Array(digest), function (x) { return ('0' + x.toString(16)).slice(-2); })
      .join('');
    return 'SAPISIDHASH ' + ts + '_' + hex;
  }

  async function nextPage(token) {
    var auth = await authHeader();
    if (!auth) return null;
    for (var attempt = 0; attempt < 3; attempt++) {
      var res = await fetch('/youtubei/v1/browse?prettyPrint=false', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          authorization: auth,
          'x-origin': location.origin,
          'x-goog-authuser': String(window.ytcfg.get('SESSION_INDEX') || '0'),
          'x-youtube-client-name': String(window.ytcfg.get('INNERTUBE_CONTEXT_CLIENT_NAME') || '1'),
          'x-youtube-client-version': String(window.ytcfg.get('INNERTUBE_CONTEXT_CLIENT_VERSION') || ''),
        },
        body: JSON.stringify({ context: window.ytcfg.get('INNERTUBE_CONTEXT'), continuation: token }),
      });
      if (res.status === 429 || res.status >= 500) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (!res.ok) return null;
      var body = await res.json();
      var items = [];
      (body.onResponseReceivedActions || []).forEach(function (a) {
        var more = (a.appendContinuationItemsAction || {}).continuationItems;
        if (Array.isArray(more)) items = items.concat(more);
      });
      return items;
    }
    return null;
  }

  function firstPage() {
    try {
      var tabs = window.ytInitialData.contents.twoColumnBrowseResultsRenderer.tabs;
      for (var i = 0; i < tabs.length; i++) {
        var list = ((tabs[i].tabRenderer || {}).content || {}).sectionListRenderer;
        if (list && Array.isArray(list.contents)) return list.contents;
      }
    } catch (e) {}
    return null;
  }

  async function collect() {
    var labels = dayLabels();
    var since = new Date();
    since.setDate(since.getDate() - WINDOW_DAYS);
    var sinceDate = localDate(since);

    var days = {};
    var total = 0;
    var undated = 0;
    var oldest = null;
    var lastDate = null;
    var truncated = false;

    var items = firstPage();
    if (!items) throw new Error('history page data not found');
    for (var page = 0; page < MAX_PAGES && items; page++) {
      var token = null;
      items.forEach(function (item) {
        if (item.continuationItemRenderer) {
          token = (((item.continuationItemRenderer.continuationEndpoint || {}).continuationCommand) || {}).token || null;
          return;
        }
        var section = item.itemSectionRenderer;
        if (!section || !Array.isArray(section.contents)) return;
        var date = labels[normal(sectionTitle(section))] || null;
        var known = !!date;
        // Sections run newest first, so an unreadable title is no later than the one before it.
        if (!date) date = lastDate;
        if (!date) return;
        lastDate = date;
        if (!oldest || date < oldest) oldest = date;
        var day = days[date] || (days[date] = { date: date, videos: 0, shorts: 0, hours: 0, listedHours: 0 });
        section.contents.forEach(function (c) {
          if (c.lockupViewModel || c.videoRenderer) {
            var v = c.lockupViewModel ? readVideo(c.lockupViewModel) : readOldVideo(c.videoRenderer);
            day.videos++;
            total++;
            if (!known) undated++;
            day.listedHours += v.duration / 3600;
            day.hours += (v.duration * (v.percent === null ? 100 : Math.min(100, v.percent))) / 100 / 3600;
          } else if (c.reelShelfRenderer) {
            var n = (c.reelShelfRenderer.items || []).length;
            day.shorts += n;
            total += n;
          }
        });
      });
      if (oldest && oldest < sinceDate) break;
      if (!token) break; // End of the history.
      if (total >= MAX_ITEMS || page === MAX_PAGES - 1) {
        truncated = true;
        break;
      }
      banner('Reading your YouTube history: ' + total + ' videos so far');
      await sleep(300);
      items = await nextPage(token);
      if (!items) truncated = true;
    }

    var round2 = function (n) { return Math.round(n * 100) / 100; };
    // A long video left playing counts as fully watched, which can add up to more
    // hours than a day has. Hold each day to 24.
    var cappedDays = 0;
    var daily = Object.keys(days)
      .filter(function (d) { return d >= sinceDate; })
      .sort()
      .map(function (d) {
        var x = days[d];
        if (x.hours > 24) cappedDays++;
        return { date: x.date, videos: x.videos, shorts: x.shorts, hours: round2(Math.min(24, x.hours)), listedHours: round2(x.listedHours) };
      });
    var sum = function (key) {
      return daily.reduce(function (t, d) { return t + d[key]; }, 0);
    };
    return {
      service: 'youtube',
      windowDays: WINDOW_DAYS,
      collectedAt: new Date().toISOString(),
      videos: sum('videos'),
      shorts: sum('shorts'),
      // Video length times the share watched, as YouTube's own progress bar shows it.
      // Shorts are counted but add no hours.
      watchedHours: round2(sum('hours')),
      listedHours: round2(sum('listedHours')),
      activeDays: daily.length,
      daily: daily,
      cappedDays: cappedDays,
      truncated: truncated,
      undatedVideos: undated,
    };
  }

  async function run() {
    if (state.started || state.done) return;
    if (!/(^|\.)youtube\.com$/.test(location.hostname)) return;
    if (!loggedIn()) return; // Not signed in yet; the poll below tries again.
    if (location.pathname !== '/feed/history') {
      location.href = HISTORY_URL;
      return;
    }
    if (!window.ytInitialData) return; // Still loading.
    state.started = true;
    try {
      banner('Reading your YouTube history. This takes about a minute.');
      var usage = await collect();
      state.usage = usage;

      if (window.Reclaim && typeof window.Reclaim.updatePublicData === 'function') {
        window.Reclaim.updatePublicData(usage);
      }
      banner('Done. Confirming your account...');
      var claim = {
        url: HISTORY_URL,
        cookies: '',
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': navigator.language || 'en-US,en;q=0.9',
          'user-agent': navigator.userAgent,
          'sec-fetch-mode': 'navigate',
        },
        method: 'GET',
        requestBody: '',
        responseBody: 'response',
        geoLocation: '{{DYNAMIC_GEO}}',
        extractedParams: { loggedIn: 'true' },
        responseMatches: [{ type: 'regex', value: '"LOGGED_IN":(?<loggedIn>true)' }],
        responseRedactions: [{ regex: '"LOGGED_IN":(?<loggedIn>true)' }],
      };
      state.claim = claim;
      if (window.Reclaim && typeof window.Reclaim.requestClaim === 'function') {
        await window.Reclaim.requestClaim(claim);
      }
      state.done = true;
    } catch (e) {
      state.error = String((e && e.message) || e);
      state.started = false;
      state.failures = (state.failures || 0) + 1;
      banner("We couldn't read your YouTube history. Trying again...");
    }
  }

  var timer = setInterval(function () {
    if (state.done || (state.failures || 0) >= 3) {
      clearInterval(timer);
      return;
    }
    run();
  }, 3000);
})();
