import { normalizeDomain, videoId, blockedDomain, buildRules, derivePin } from './core.js';
let adult = [];
const adultReady = fetch(chrome.runtime.getURL('adult-domains.json')).then(r => r.json()).then(domains => { adult = domains; });
const blank = () => ({domains: [], videos: [], credential: null});
let queue = Promise.resolve();
function serial(fn) { const result = queue.then(async () => { await adultReady; return fn(); }); queue = result.catch(() => {}); return result; }
const state = async () => (await chrome.storage.local.get('state')).state || blank();
const session = async () => ({grants: {}, adminUntil: 0, ...await chrome.storage.session.get(null)});
async function syncRules(s) {
  const previous = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({removeRuleIds: previous.map(r => r.id), addRules: buildRules(s, adult, chrome.runtime.getURL('blocked.html'))});
  const {grants} = await session();
  const active = Object.entries(grants).filter(([, t]) => t > Date.now());
  await chrome.storage.session.set({grants: Object.fromEntries(active)});
  const old = await chrome.declarativeNetRequest.getSessionRules();
  await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds: old.map(r => r.id), addRules: active.map(([domain], i) => ({id: 10000 + i, priority: 20, action: {type: 'allow'}, condition: {requestDomains: [domain], resourceTypes: ['main_frame', 'sub_frame']}}))});
  await chrome.alarms.clear('expiry');
  if (active.length) await chrome.alarms.create('expiry', {when: Math.min(...active.map(([, t]) => t))});
}
async function enforceTab(tabId, url, s, grants) {
  if (blockedDomain(url, s, adult, grants)) await chrome.tabs.update(tabId, {url: chrome.runtime.getURL('blocked.html') + '#' + url}).catch(() => {});
}
async function enforceAll() {
  const s = await state(), {grants} = await session();
  await Promise.all((await chrome.tabs.query({})).map(t => enforceTab(t.id, t.url, s, grants)));
}
async function verify(pin) {
  const s = await state();
  const lock = (await chrome.storage.local.get('lock')).lock || {failures: 0, until: 0};
  if (lock.until > Date.now()) throw Error(`Too many attempts. Try again in ${Math.ceil((lock.until - Date.now()) / 1000)} seconds.`);
  if (!s.credential || !/^\d{4}$/.test(String(pin)) || await derivePin(pin, s.credential.salt) !== s.credential.hash) {
    lock.failures++;
    if (lock.failures >= 5) { lock.until = Date.now() + 60000; lock.failures = 0; }
    await chrome.storage.local.set({lock});
    throw Error('Incorrect PIN. After 5 failed attempts, access pauses for 60 seconds.');
  }
  await chrome.storage.local.remove('lock');
}
function assertPage(sender, pages) {
  if (sender.id !== chrome.runtime.id || sender.tab && !sender.url?.startsWith(chrome.runtime.getURL('')) || !pages.some(p => sender.url?.split(/[?#]/)[0] === chrome.runtime.getURL(p))) throw Error('Permission denied.');
}
async function handle(m, sender) {
  if (m.type === 'check') {
    if (!sender.tab || !sender.url?.startsWith('http')) throw Error('Permission denied.');
    const s = await state(), {grants} = await session();
    const url = m.url || sender.url;
    // Content scripts can request a read-only decision only.
    return {blocked: !!blockedDomain(url, s, adult, grants), blockedPage: chrome.runtime.getURL('blocked.html')};
  }
  assertPage(sender, ['options.html', 'blocked.html', 'popup.html']);
  const s = await state(), sess = await session();
  if (m.type === 'status') return {configured: !!s.credential, domains: s.domains.length, videos: s.videos.length, adultCount: adult.length};
  if (m.type === 'setup') {
    assertPage(sender, ['options.html']);
    if (s.credential) throw Error('A PIN is already configured.');
    if (!/^\d{4}$/.test(m.pin)) throw Error('Use exactly 4 digits.');
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)));
    s.credential = {salt, hash: await derivePin(m.pin, salt)};
    await chrome.storage.local.set({state: s});
    await chrome.storage.session.set({adminUntil: Date.now() + 300000});
    await syncRules(s); return {ok: true};
  }
  if (m.type === 'login') {
    assertPage(sender, ['options.html']); await verify(m.pin);
    await chrome.storage.session.set({adminUntil: Date.now() + 300000}); return {ok: true};
  }
  if (m.type === 'unlock') {
    assertPage(sender, ['blocked.html']); await verify(m.pin);
    const u = new URL(m.url);
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) throw Error('Invalid destination.');
    const domain = blockedDomain(u.href, s, adult, {});
    if (!domain) return {ok: true, url: u.href};
    sess.grants[domain] = Date.now() + 15 * 60000;
    await chrome.storage.session.set({grants: sess.grants});
    await syncRules(s); return {ok: true, url: u.href};
  }
  assertPage(sender, ['options.html']);
  if (!s.credential || sess.adminUntil <= Date.now()) throw Error('Settings locked. Enter your PIN again.');
  if (m.type === 'get') return {...s, credential: undefined, adultCount: adult.length, grants: sess.grants};
  if (m.type === 'logout') { await chrome.storage.session.set({adminUntil: 0}); return {ok: true}; }
  if (m.type === 'domainAdd') {
    const domain = normalizeDomain(m.value);
    if (!s.domains.includes(domain)) s.domains.push(domain);
    if (s.domains.length > 500) throw Error('Maximum 500 domains.');
  } else if (m.type === 'domainRemove') s.domains = s.domains.filter(x => x !== m.value);
  else if (m.type === 'videoAdd') {
    const id = videoId(m.value);
    if (!s.videos.some(v => v.id === id)) s.videos.push({id, title: String(m.title || '').trim().slice(0, 100) || id});
    if (s.videos.length > 100) throw Error('Maximum 100 approved videos.');
  } else if (m.type === 'videoRemove') s.videos = s.videos.filter(v => v.id !== m.value);
  else if (m.type === 'revoke') await chrome.storage.session.set({grants: {}});
  else if (m.type === 'changePin') {
    await verify(m.currentPin);
    if (!/^\d{4}$/.test(m.pin)) throw Error('Use exactly 4 digits.');
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)));
    s.credential = {salt, hash: await derivePin(m.pin, salt)};
  } else throw Error('Unknown command.');
  // Validate and install rules before persisting configuration.
  await syncRules(s);
  await chrome.storage.local.set({state: s});
  await enforceAll(); return {ok: true};
}
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  serial(() => handle(m, sender)).then(data => reply({data}), e => reply({error: e.message})); return true;
});
async function initialize() {
  await chrome.storage.local.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'});
  await syncRules(await state()); await enforceAll();
}
chrome.runtime.onInstalled.addListener(() => { serial(initialize).catch(console.error); });
chrome.runtime.onStartup.addListener(() => { serial(initialize).catch(console.error); });
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'expiry') serial(async () => { await syncRules(await state()); await enforceAll(); }).catch(console.error); });
async function navigation(d) {
  if (d.frameId !== 0) return;
  await serial(async () => { const s = await state(), {grants} = await session(); await enforceTab(d.tabId, d.url, s, grants); });
}
chrome.webNavigation.onCommitted.addListener(d => { navigation(d).catch(console.error); });
chrome.webNavigation.onHistoryStateUpdated.addListener(d => { navigation(d).catch(console.error); });
chrome.webNavigation.onReferenceFragmentUpdated.addListener(d => { navigation(d).catch(console.error); });
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
