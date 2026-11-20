(() => {
  let last = '', pending = false;
  async function check() {
    if (pending) return;
    const url = location.href;
    pending = true;
    try {
      const {data} = await chrome.runtime.sendMessage({type: 'check', url});
      if (data?.blocked && location.href === url) {
        document.querySelectorAll('video,audio').forEach(v => v.pause());
        if (window === window.top) location.replace(data.blockedPage + '#' + url);
        else { document.documentElement?.replaceChildren(); }
      }
      last = url;
    } catch { /* The extension may have been reloaded. */ }
    finally { pending = false; }
  }
  check();
  // Resolve ordinary YouTube link clicks before the site's SPA starts playing.
  document.addEventListener('click', event => {
    if (!/(^|\.)youtube\.com$/.test(location.hostname) || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.composedPath().find(node => node instanceof HTMLAnchorElement);
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
    let url; try { url = new URL(link.href); } catch { return; }
    if (!['http:', 'https:'].includes(url.protocol)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    chrome.runtime.sendMessage({type: 'check', url: url.href}).then(({data}) => {
      if (!data) return;
      location.assign(data.blocked ? data.blockedPage + '#' + url.href : url.href);
    }).catch(() => {});
  }, true);
  // YouTube navigation is often handled without a new document request.
  document.addEventListener('yt-navigate-start', () => { last = ''; check(); }, true);
  document.addEventListener('yt-navigate-finish', check, true);
  addEventListener('popstate', check);
  addEventListener('hashchange', check);
  document.addEventListener('play', check, true);
  setInterval(() => { if (location.href !== last) check(); }, 250);
})();
