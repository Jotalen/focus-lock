import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDomain, videoId, isApprovedVideo, blockedDomain, pagePolicy, buildRules, derivePin} from '../core.js';
const id = 'FLDx2MFEkdU';
const state = {domains: ['youtube.com', 'example.com'], videos: [{id}]};
test('domain normalization preserves boundaries and rejects paths and credentials', () => {
  assert.equal(normalizeDomain('https://www.Example.com/'), 'example.com');
  for (const x of ['example.com/path', 'https://me:pass@example.com', 'https://example.com:8080', '*.com', 'file:///etc/passwd', 'com', 'example.com?x=y']) assert.throws(() => normalizeDomain(x));
  assert.equal(blockedDomain('https://a.example.com/', state, []), 'example.com');
  assert.equal(blockedDomain('https://notexample.com/', state, []), null);
  assert.equal(blockedDomain('https://example.com.evil.test/', state, []), null);
  assert.equal(blockedDomain('https://adult.test/', state, ['adult.test']), 'adult.test');
});
test('normalize supported video links and reject malicious or ambiguous IDs', () => {
  for (const url of [id, `https://youtu.be/${id}?t=3`, `https://www.youtube.com/watch?v=${id}&t=3`, `https://youtube.com/shorts/${id}`, `https://m.youtube.com/live/${id}`, `https://www.youtube-nocookie.com/embed/${id}`]) assert.equal(videoId(url), id);
  for (const url of [`https://evil.test/watch?v=${id}`, `https://youtube.com/watch?v=${id}&v=aaaaaaaaaaa`, 'https://youtube.com/@channel', 'javascript:alert(1)', `https://youtube.com.evil.test/watch?v=${id}`, `https://youtube.com/%ZZ/${id}`, 'https://youtube.com/playlist?list=abc']) assert.throws(() => videoId(url));
});
test('YouTube homepage, search, channels, feeds and playlists stay browsable', () => {
  for (const url of ['https://youtube.com/', 'https://youtube.com/feed/subscriptions', 'https://youtube.com/results?search_query=math', 'https://youtube.com/@teacher/videos', 'https://youtube.com/channel/abc', 'https://youtube.com/playlist?list=abc', 'https://m.youtube.com/results?search_query=math', 'https://music.youtube.com/']) {
    assert.equal(blockedDomain(url, state, []), null, url);
    assert.equal(pagePolicy(url, state, []).playbackAllowed, false, url);
  }
});
test('approved videos use exact, case-sensitive IDs across supported URL forms', () => {
  for (const url of [`https://www.youtube.com/watch?v=${id}&t=30`, `https://m.youtube.com/watch?t=3&v=${id}&list=abc#t=30`, `https://youtube.com/shorts/${id}`, `https://youtube.com/live/${id}`, `https://youtube.com/embed/${id}`, `https://www.youtube-nocookie.com/embed/${id}`, `https://youtu.be/${id}`, `https://youtube.com/watch?%76=${id}`, `https://youtube.com./watch?v=${id}`]) {
    assert.equal(isApprovedVideo(url, state.videos), true, url);
    assert.deepEqual(pagePolicy(url, state, []), {blockedDomain: null, playbackAllowed: true}, url);
  }
  assert.equal(isApprovedVideo(`https://youtube.com/watch?v=${id.toLowerCase()}`, state.videos), false);
});
test('unapproved and malformed video routes block without blocking browsing', () => {
  for (const url of ['https://youtube.com/watch?v=aaaaaaaaaaa', `https://youtube.com/watch?v=${id}&v=aaaaaaaaaaa`, `https://youtube.com/watch?v=aaaaaaaaaaa&v=${id}`, `https://youtube.com/watch?v=${id}&%76=aaaaaaaaaaa`, `https://youtube.com/watch?v=${id}extra`, 'https://youtube.com/watch', 'https://youtube.com/shorts/aaaaaaaaaaa', 'https://youtube.com/live/aaaaaaaaaaa', 'https://youtube.com/embed/videoseries?list=abc', 'https://youtube.com/v/aaaaaaaaaaa', 'https://youtube.com/%77atch?v=aaaaaaaaaaa', 'https://youtu.be/aaaaaaaaaaa', 'https://www.youtube-nocookie.com/embed/aaaaaaaaaaa']) {
    assert.equal(blockedDomain(url, state, []), 'youtube.com', url);
    assert.equal(pagePolicy(url, state, []).playbackAllowed, false, url);
  }
});
test('YouTube playback is unrestricted when it is not in the blocked list', () => {
  const unrestricted = {domains: ['example.com'], videos: []};
  for (const url of ['https://youtube.com/', 'https://youtube.com/watch?v=aaaaaaaaaaa', 'https://youtu.be/aaaaaaaaaaa']) assert.deepEqual(pagePolicy(url, unrestricted, []), {blockedDomain: null, playbackAllowed: true});
});
test('temporary grants cover YouTube aliases and expire exactly', () => {
  assert.equal(blockedDomain('https://m.example.com', state, [], {'example.com': 100}, 99), null);
  assert.equal(blockedDomain('https://m.example.com', state, [], {'example.com': 100}, 100), 'example.com');
  assert.equal(blockedDomain('https://youtube.com/watch?v=aaaaaaaaaaa', state, [], {'example.com': 100}, 99), 'youtube.com');
  for (const url of ['https://youtube.com/', 'https://youtube.com/watch?v=aaaaaaaaaaa', 'https://youtu.be/aaaaaaaaaaa', 'https://www.youtube-nocookie.com/embed/aaaaaaaaaaa']) {
    assert.deepEqual(pagePolicy(url, state, [], {'youtube.com': 100}, 99), {blockedDomain: null, playbackAllowed: true});
    assert.equal(pagePolicy(url, state, [], {'youtube.com': 100}, 100).playbackAllowed, false);
  }
});
test('network rules retain normal site protection and generate no YouTube/video regex rules', () => {
  const rules = buildRules(state, ['adult.test'], 'chrome-extension://id/blocked.html');
  assert.equal(rules.length, 2);
  assert.equal(rules[0].action.redirect.regexSubstitution, 'chrome-extension://id/blocked.html#\\0');
  for (const rule of rules) assert.deepEqual(rule.condition.requestDomains, ['adult.test', 'example.com']);
  assert.equal(rules[1].action.type, 'block');
  const many = {...state, videos: Array.from({length: 100}, (_, i) => ({id: String(i).padStart(11, '0')}))};
  assert.deepEqual(buildRules(many, ['adult.test'], 'chrome-extension://id/blocked.html'), rules);
  assert.deepEqual(buildRules({domains: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'], videos: []}, [], 'blocked'), []);
});
test('PIN hashing uses the salt and verifies deterministically', async () => {
  const a = await derivePin('1234', [1,2,3]);
  assert.equal(a, await derivePin('1234', [1,2,3]));
  assert.notEqual(a, await derivePin('1235', [1,2,3]));
  assert.notEqual(a, await derivePin('1234', [3,2,1]));
});
