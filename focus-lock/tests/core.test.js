import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDomain, videoId, blockedDomain, buildRules, derivePin} from '../core.js';
const id = 'dQw4w9WgXcQ';
const state = {domains: ['youtube.com', 'example.com'], videos: [{id}]};
test('domain normalization preserves boundaries and rejects paths and credentials', () => {
  assert.equal(normalizeDomain('https://www.Example.com/'), 'example.com');
  for (const x of ['example.com/path', 'https://me:pass@example.com', 'https://example.com:8080', '*.com', 'file:///etc/passwd', 'com', 'example.com?x=y']) assert.throws(() => normalizeDomain(x));
  assert.equal(blockedDomain('https://a.example.com/', state, []), 'example.com');
  assert.equal(blockedDomain('https://notexample.com/', state, []), null);
  assert.equal(blockedDomain('https://example.com.evil.test/', state, []), null);
});
test('normalize supported video links and reject malicious or ambiguous IDs', () => {
  for (const url of [id, `https://youtu.be/${id}?t=3`, `https://www.youtube.com/watch?v=${id}&t=3`, `https://youtube.com/shorts/${id}`]) assert.equal(videoId(url), id);
  for (const url of [`https://evil.test/watch?v=${id}`, `https://youtube.com/watch?v=${id}&v=aaaaaaaaaaa`, 'https://youtube.com/@channel', 'javascript:alert(1)']) assert.throws(() => videoId(url));
});
test('allow only approved watch videos, not home, playlists, unrelated or duplicate videos', () => {
  assert.equal(blockedDomain(`https://www.youtube.com/watch?v=${id}&t=30`, state, []), null);
  for (const url of ['https://youtube.com/', 'https://youtube.com/feed/subscriptions', 'https://youtube.com/watch?v=aaaaaaaaaaa', `https://youtube.com/watch?v=${id}&v=aaaaaaaaaaa`, `https://youtube.com/shorts/${id}`]) assert.equal(blockedDomain(url, state, []), 'youtube.com');
  assert.equal(blockedDomain('https://adult.test/', state, ['adult.test']), 'adult.test');
});
test('temporary access expires exactly and never grants sibling domains', () => {
  assert.equal(blockedDomain('https://m.example.com', state, [], {'example.com': 100}, 99), null);
  assert.equal(blockedDomain('https://m.example.com', state, [], {'example.com': 100}, 100), 'example.com');
  assert.equal(blockedDomain('https://youtube.com', state, [], {'example.com': 100}, 99), 'youtube.com');
});
test('generated redirect rules and video exceptions match canonical destinations', () => {
  const rules = buildRules(state, ['adult.test'], 'chrome-extension://id/blocked.html');
  assert.equal(rules[0].action.redirect.regexSubstitution, 'chrome-extension://id/blocked.html#\\0');
  const re = new RegExp(rules[2].condition.regexFilter);
  assert.ok(re.test(`https://www.youtube.com/watch?v=${id}`));
  assert.ok(re.test(`https://m.youtube.com/watch?t=3&v=${id}&a=1`));
  for (const url of [`https://youtube.com.evil.test/watch?v=${id}`, `https://www.youtube.com/watch?v=${id}extra`, `https://evil.test/?https://youtube.com/watch?v=${id}`, `https://youtube.com/watch?v=${id}&v=aaaaaaaaaaa`, `https://youtube.com/watch?v=aaaaaaaaaaa&v=${id}`, `https://youtube.com/watch?v=${id}&%76=aaaaaaaaaaa`]) assert.ok(!re.test(url));
  assert.ok(rules[2].priority > rules[0].priority);
});
test('PIN hashing uses the salt and verifies deterministically', async () => {
  const a = await derivePin('1234', [1,2,3]);
  assert.equal(a, await derivePin('1234', [1,2,3]));
  assert.notEqual(a, await derivePin('1235', [1,2,3]));
  assert.notEqual(a, await derivePin('1234', [3,2,1]));
});
