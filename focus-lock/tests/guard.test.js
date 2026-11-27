import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {pagePolicy} from '../core.js';
const code = await fs.readFile(new URL('../guard.js', import.meta.url), 'utf8');
const approved = 'FLDx2MFEkdU';
const policyState = {domains: ['youtube.com'], videos: [{id: approved}]};
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function fixture(url, {frame = false, deferred = false} = {}) {
  const listeners = {}, messages = [], redirects = [], requests = [], timers = [];
  const location = {href: url, hostname: new URL(url).hostname, replace(url) { redirects.push(url); }, assign(url) { redirects.push(url); }};
  const media = {paused: true, isConnected: true, pauses: 0, plays: 0, pause() { this.paused = true; this.pauses++; }, async play() { this.paused = false; this.plays++; }};
  let cleared = false;
  const document = {
    querySelectorAll() { return [media]; },
    documentElement: {replaceChildren() { cleared = true; }},
    addEventListener(name, fn) { (listeners[name] ||= []).push(fn); }
  };
  function reply(url) {
    const p = pagePolicy(url, policyState, []);
    return {data: {blocked: !!p.blockedDomain, playbackAllowed: p.playbackAllowed, blockedPage: 'chrome-extension://test/blocked.html'}};
  }
  const window = {}; window.top = frame ? {} : window;
  const context = vm.createContext({location, document, window, URL, Set, HTMLAnchorElement: class {},
    chrome: {runtime: {async sendMessage(m) {
      requests.push(m.url);
      if (deferred) return new Promise(resolve => messages.push(() => resolve(reply(m.url))));
      return reply(m.url);
    }, onMessage: {addListener(fn) { listeners.message = [fn]; }}}},
    addEventListener(name, fn) { (listeners[name] ||= []).push(fn); },
    setInterval(fn) { timers.push(fn); }
  });
  vm.runInContext(code, context);
  return {location, media, redirects, requests, timers, messages, get cleared() { return cleared; },
    event(name, value = {}) { for (const fn of listeners[name] || []) fn(value); }};
}
test('browsing remains open while preview and miniplayer playback are paused', async () => {
  const f = fixture('https://youtube.com/results?search_query=math');
  await flush();
  assert.deepEqual(f.redirects, []);
  f.media.paused = false; f.event('play');
  assert.equal(f.media.paused, true);
  await flush();
  assert.equal(f.media.plays, 0);
  assert.deepEqual(f.redirects, []);
});
test('approved playback survives pending checks and is resumed once approved', async () => {
  const f = fixture(`https://youtube.com/watch?v=${approved}`, {deferred: true});
  f.media.paused = false; f.event('play');
  assert.equal(f.media.paused, true);
  f.messages.shift()(); await flush();
  assert.equal(f.media.paused, false);
  assert.equal(f.media.plays, 1);
  assert.deepEqual(f.redirects, []);
  // Finish the queued recheck as well.
  f.messages.shift()(); await flush();
  assert.equal(f.media.plays, 1);
});
test('in-page navigation and Back stop an unapproved video', async () => {
  const f = fixture(`https://youtube.com/watch?v=${approved}`);
  await flush();
  f.location.href = 'https://youtube.com/watch?v=aaaaaaaaaaa';
  f.media.paused = false; f.event('play');
  assert.equal(f.media.paused, true);
  await flush();
  assert.ok(f.redirects.at(-1).endsWith('#' + f.location.href));
  f.location.href = `https://youtube.com/watch?v=${approved}`;
  f.event('popstate'); await flush();
  f.media.paused = false; f.event('play'); await flush();
  assert.equal(f.media.paused, false);
});
test('a stale blocked response cannot redirect a newer approved route', async () => {
  const f = fixture('https://youtube.com/watch?v=aaaaaaaaaaa', {deferred: true});
  f.location.href = `https://youtube.com/watch?v=${approved}`;
  f.event('yt-navigate-finish');
  f.messages.shift()(); await flush();
  assert.deepEqual(f.redirects, []);
  assert.equal(f.messages.length, 1);
  f.messages.shift()(); await flush();
  assert.deepEqual(f.redirects, []);
});
test('unapproved embedded players are cleared without redirecting the parent', async () => {
  const f = fixture('https://www.youtube-nocookie.com/embed/aaaaaaaaaaa', {frame: true});
  await flush();
  assert.equal(f.cleared, true);
  assert.deepEqual(f.redirects, []);
});
test('changes to saved approvals recheck an already-open video', async () => {
  const f = fixture(`https://youtube.com/watch?v=${approved}`);
  await flush();
  const saved = policyState.videos;
  try {
    policyState.videos = [];
    f.event('message', {type: 'recheck'}); await flush();
    assert.ok(f.redirects.at(-1).endsWith('#' + f.location.href));
  } finally { policyState.videos = saved; }
});
