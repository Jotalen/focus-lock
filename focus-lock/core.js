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
export function videoId(value) {
  const raw = String(value || '').trim();
  if (/^[\w-]{11}$/.test(raw)) return raw;
  let u; try { u = new URL(raw); } catch { throw Error('Paste a YouTube video URL or its 11-character ID.'); }
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.port) throw Error('Invalid YouTube URL.');
  const host = u.hostname.toLowerCase();
  let id;
  if (host === 'youtu.be') id = u.pathname.slice(1);
  else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
    if (u.pathname === '/watch' && u.searchParams.getAll('v').length === 1) id = u.searchParams.get('v');
    else id = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})\/?$/)?.[1];
  }
  if (!/^[\w-]{11}$/.test(id || '')) throw Error('Use a specific YouTube video, not a channel or playlist.');
  return id;
}
export function videoPattern(id) {
  // RE2-compatible: disallow a second v key, including encoded parameter names.
  const other = '([a-uw-zA-Z0-9_.~-][a-zA-Z0-9_.~-]*|v[a-zA-Z0-9_.~-]+)(=[^&#]*)?';
  return `^https?://(www\\.|m\\.)?youtube\\.com/watch\\?(${other}&)*v=${id}(&${other})*(#.*)?$`;
}
export function isApprovedVideo(url, videos) {
  try {
    const u = new URL(url);
    // Only canonical watch pages are allowed; pasted links are normalized to these.
    return ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(u.hostname) && u.pathname === '/watch' && u.searchParams.getAll('v').length === 1 && videos.some(v => new RegExp(videoPattern(v.id)).test(url));
  } catch { return false; }
}
export function blockedDomain(url, state, adult, grants = {}, now = Date.now()) {
  let u; try { u = new URL(url); } catch { return null; }
  if (!['http:', 'https:'].includes(u.protocol)) return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (Object.entries(grants).some(([d, until]) => until > now && matchesDomain(host, d))) return null;
  const domain = [...state.domains, ...adult].find(d => matchesDomain(host, d));
  if (!domain) return null;
  if (isApprovedVideo(url, state.videos)) return null;
  return domain;
}
export function buildRules(state, adult, blockedPage) {
  const domains = [...new Set([...adult, ...state.domains])];
  const rules = domains.length ? [{id: 1, priority: 1, action: {type: 'redirect', redirect: {regexSubstitution: `${blockedPage}#\\0`}}, condition: {requestDomains: domains, regexFilter: '^https?://.*', resourceTypes: ['main_frame']}}, {id: 2, priority: 1, action: {type: 'block'}, condition: {requestDomains: domains, resourceTypes: ['sub_frame']}}] : [];
  state.videos.forEach((v, i) => rules.push({id: 100 + i, priority: 10, action: {type: 'allow'}, condition: {regexFilter: videoPattern(v.id), isUrlFilterCaseSensitive: true, resourceTypes: ['main_frame']}}));
  return rules;
}
export async function derivePin(pin, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name: 'PBKDF2', salt: Uint8Array.from(salt), iterations: 210000, hash: 'SHA-256'}, key, 256);
  return Array.from(new Uint8Array(bits), x => x.toString(16).padStart(2, '0')).join('');
}
