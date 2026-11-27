(() => {
  const youtube = /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/.test(location.hostname.replace(/\.$/, ''));
  let last = '', pending = false, rerun = false, decision = null;
  const pausedForCheck = new Set();
  function pauseMedia(remember = false) {
    document.querySelectorAll('video,audio').forEach(media => {
      if (remember && !media.paused) pausedForCheck.add(media);
      media.pause();
    });
  }
  async function check() {
    if (pending) { rerun = true; return; }
    const url = location.href;
    pending = true;
    if (youtube && (!decision || decision.url !== url || !decision.playbackAllowed)) pauseMedia(true);
    try {
      const {data} = await chrome.runtime.sendMessage({type: 'check', url});
      // Never apply a response to another route, even during rapid SPA changes.
      if (!data || location.href !== url) return;
      decision = {url, playbackAllowed: data.playbackAllowed};
      if (!data.playbackAllowed) { pausedForCheck.clear(); pauseMedia(); }
      if (data.blocked) {
        if (window === window.top) location.replace(data.blockedPage + '#' + url);
        else document.documentElement?.replaceChildren();
      } else if (data.playbackAllowed) {
        const resume = [...pausedForCheck]; pausedForCheck.clear();
        for (const media of resume) if (media.isConnected && media.paused) media.play().catch(() => {});
      }
      last = url;
    } catch { /* The extension may have been reloaded. */ }
    finally {
      pending = false;
      if (rerun || location.href !== url) { rerun = false; pausedForCheck.clear(); check(); }
    }
  }
  check();
  // Resolve normal video clicks before YouTube's SPA starts playback. Browsing
  // links retain native navigation, scroll position and browser history behavior.
  document.addEventListener('click', event => {
    if (!youtube || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.composedPath().find(node => node instanceof HTMLAnchorElement);
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
    let url; try { url = new URL(link.href); } catch { return; }
    if (!/(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/.test(url.hostname.replace(/\.$/, ''))) return;
    let path; try { path = decodeURIComponent(url.pathname); } catch { return; }
    if (!/^\/(?:watch|watch_popup|shorts|embed|live|v|e)(?:\/|$)/.test(path) && !/(^|\.)youtu\.be$/.test(url.hostname)) return;
    if (!['http:', 'https:'].includes(url.protocol)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const from = location.href;
    chrome.runtime.sendMessage({type: 'check', url: url.href}).then(({data}) => {
      if (!data || location.href !== from) return;
      location.assign(data.blocked ? data.blockedPage + '#' + url.href : url.href);
    }).catch(() => {});
  }, true);
  function recheck() { decision = null; last = ''; check(); }
  document.addEventListener('yt-navigate-start', recheck, true);
  document.addEventListener('yt-navigate-finish', recheck, true);
  addEventListener('popstate', recheck);
  addEventListener('hashchange', recheck);
  addEventListener('pageshow', recheck);
  document.addEventListener('play', () => {
    if (youtube && (!decision || decision.url !== location.href || !decision.playbackAllowed)) pauseMedia(true);
    check();
  }, true);
  chrome.runtime.onMessage.addListener(m => { if (m.type === 'recheck') recheck(); });
  setInterval(() => {
    if (location.href !== last) check();
    if (youtube && decision?.url === location.href && !decision.playbackAllowed) pauseMedia();
  }, 250);
})();
