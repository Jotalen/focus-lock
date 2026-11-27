export function normalizeDomain(input) {
  const value = String(input || '').trim();
  if (!value || value.length > 2048) throw Error('Enter a domain such as youtube.com.');
  const url = new URL(value.includes('://') ? value : `https://${value}`);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || url.search || url.hash || !['', '/'].includes(url.pathname)) throw Error('Enter a domain only, without a path, port, or query.');
  const host = url.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) throw Error('Enter a valid public domain such as youtube.com.');
  return host;
}
export const matchesDomain = (host, domain) => host === domain || host.endsWith(`.${domain}`);
const youtubeDomains = ['youtube.com', 'youtu.be', 'youtube-nocookie.com'];
export const isYouTubeHost = host => youtubeDomains.some(d => matchesDomain(host.toLowerCase().replace(/\.$/, ''), d));
// Blocking youtube.com also covers its short links and privacy-enhanced embeds.
const domainApplies = (host, domain) => matchesDomain(host, domain) || domain === 'youtube.com' && isYouTubeHost(host);
function parsedVideoId(u) {
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!isYouTubeHost(host)) return null;
  const path = decodeURIComponent(u.pathname);
  let id;
  if (matchesDomain(host, 'youtu.be')) id = path.match(/^\/([\w-]{11})\/?$/)?.[1];
  else if (/^\/(?:watch|watch_popup)\/?$/.test(path)) {
    // URLSearchParams also catches duplicate encoded keys such as %76.
    if (u.searchParams.getAll('v').length === 1) id = u.searchParams.get('v');
  } else id = path.match(/^\/(?:shorts|embed|live|v|e)\/([\w-]{11})\/?$/)?.[1];
  return /^[\w-]{11}$/.test(id || '') ? id : null;
}
function isVideoPage(u) {
  const path = decodeURIComponent(u.pathname);
  if (matchesDomain(u.hostname.replace(/\.$/, ''), 'youtu.be')) return path !== '/';
  // Malformed video destinations are blocked too, rather than treated as browsing.
  return /^\/(?:watch|watch_popup|shorts|embed|live|v|e)(?:\/|$)/.test(path);
}
export function videoId(value) {
  const raw = String(value || '').trim();
  if (/^[\w-]{11}$/.test(raw)) return raw;
  let u; try { u = new URL(raw); } catch { throw Error('Paste a YouTube video URL or its 11-character ID.'); }
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.port) throw Error('Invalid YouTube URL.');
  let id; try { id = parsedVideoId(u); } catch { /* Invalid encoded path. */ }
  if (!id) throw Error('Use a specific YouTube video, not a channel or playlist.');
  return id;
}
export function isApprovedVideo(url, videos) {
  try {
    const id = videoId(url);
    return videos.some(v => v.id === id);
  } catch { return false; }
}
export function pagePolicy(url, state, adult, grants = {}, now = Date.now()) {
  const allowed = {blockedDomain: null, playbackAllowed: true};
  let u; try { u = new URL(url); } catch { return allowed; }
  if (!['http:', 'https:'].includes(u.protocol)) return allowed;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (Object.entries(grants).some(([d, until]) => until > now && domainApplies(host, d))) return allowed;
  const domain = [...state.domains, ...adult].find(d => domainApplies(host, d));
  if (!domain) return allowed;
  if (isYouTubeHost(host)) {
    if (isApprovedVideo(url, state.videos)) return allowed;
    try {
      // Search, channels, playlists and the homepage stay usable. Pause previews
      // and the miniplayer there so browsing cannot play unapproved videos.
      if (!isVideoPage(u)) return {blockedDomain: null, playbackAllowed: false};
    } catch { /* Invalid encoded playback paths stay blocked. */ }
  }
  return {blockedDomain: domain, playbackAllowed: false};
}
export function blockedDomain(url, state, adult, grants = {}, now = Date.now()) {
  return pagePolicy(url, state, adult, grants, now).blockedDomain;
}
export function buildRules(state, adult, blockedPage) {
  // YouTube is checked by URL in the worker and page guard, never by a per-video
  // DNR regex. Keeping it out also lets browser/search/channel pages load.
  const domains = [...new Set([...adult, ...state.domains])].filter(d => !isYouTubeHost(d));
  const rules = domains.length ? [{id: 1, priority: 1, action: {type: 'redirect', redirect: {regexSubstitution: `${blockedPage}#\\0`}}, condition: {requestDomains: domains, regexFilter: '^https?://.*', resourceTypes: ['main_frame']}}, {id: 2, priority: 1, action: {type: 'block'}, condition: {requestDomains: domains, resourceTypes: ['sub_frame']}}] : [];
  return rules;
}
export async function derivePin(pin, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name: 'PBKDF2', salt: Uint8Array.from(salt), iterations: 210000, hash: 'SHA-256'}, key, 256);
  return Array.from(new Uint8Array(bits), x => x.toString(16).padStart(2, '0')).join('');
}
