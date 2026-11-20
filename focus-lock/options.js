import {send, $, message, pinInput} from './ui.js';
let configured = false, timer;
['pin', 'confirm', 'currentPin', 'newPin', 'newConfirm'].forEach(id => pinInput($(id)));
function lock() { clearTimeout(timer); $('settings').hidden = true; $('auth').hidden = false; $('pin').value = ''; }
async function render() {
  const s = await send('get');
  $('auth').hidden = true; $('settings').hidden = false;
  $('summary').textContent = `${s.domains.length} blocked sites · ${s.videos.length} approved videos`;
  $('adultText').textContent = `${s.adultCount} bundled domains and their subdomains are blocked by default.`;
  function list(id, values, kind) {
    $(id).replaceChildren();
    if (!values.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = kind === 'domain' ? 'No custom sites yet.' : 'No videos approved yet.'; $(id).append(li); }
    values.forEach(value => {
      const li = document.createElement('li'), text = document.createElement('span'), remove = document.createElement('button');
      if (kind === 'video') { const a = document.createElement('a'); a.textContent = value.title; a.href = `https://www.youtube.com/watch?v=${value.id}`; a.target = '_blank'; a.rel = 'noopener'; text.append(a); const small = document.createElement('small'); small.textContent = value.id; text.append(small); }
      else text.textContent = value;
      remove.textContent = 'Remove'; remove.className = 'text-button'; remove.setAttribute('aria-label', `Remove ${kind === 'video' ? value.title : value}`);
      remove.onclick = () => run(async () => { await send(kind + 'Remove', {value: kind === 'video' ? value.id : value}); await render(); message('Removed.'); });
      li.append(text, remove); $(id).append(li);
    });
  }
  list('domains', s.domains, 'domain'); list('videos', s.videos, 'video');
}
async function run(fn) { try { await fn(); } catch (e) { message(e.message, true); if (e.message.includes('Settings locked')) lock(); } }
async function start() {
  const s = await send('status'); configured = s.configured;
  if (!configured) { $('authTitle').textContent = 'Create your 4-digit PIN'; $('authText').textContent = 'Use this PIN to unlock websites and protect your settings. Adult-site protection is already active.'; $('authButton').textContent = 'Create PIN'; $('confirmWrap').hidden = false; $('confirm').required = true; }
}
$('authForm').onsubmit = e => { e.preventDefault(); run(async () => {
  if (!configured && $('pin').value !== $('confirm').value) throw Error('The PINs do not match.');
  await send(configured ? 'login' : 'setup', {pin: $('pin').value}); configured = true;
  $('authTitle').textContent = 'Unlock your settings'; $('authText').textContent = 'Enter your 4-digit PIN to manage your settings.'; $('authButton').textContent = 'Unlock settings'; $('confirmWrap').hidden = true; $('confirm').required = false;
  $('authForm').reset(); clearTimeout(timer); timer = setTimeout(() => { lock(); message('Settings locked. Enter your PIN again.'); }, 300000);
  await render(); message('Settings unlocked for 5 minutes.');
}); };
$('domainForm').onsubmit = e => { e.preventDefault(); run(async () => { await send('domainAdd', {value: $('domain').value}); $('domainForm').reset(); await render(); message('Website blocked.'); }); };
$('videoForm').onsubmit = e => { e.preventDefault(); run(async () => { await send('videoAdd', {value: $('video').value, title: $('title').value}); $('videoForm').reset(); await render(); message('Video approved.'); }); };
$('lock').onclick = () => run(async () => { await send('logout'); lock(); message('Settings locked.'); });
$('revoke').onclick = () => run(async () => { await send('revoke'); message('All temporary website unlocks ended.'); });
$('pinForm').onsubmit = e => { e.preventDefault(); run(async () => { if ($('newPin').value !== $('newConfirm').value) throw Error('The new PINs do not match.'); await send('changePin', {currentPin: $('currentPin').value, pin: $('newPin').value}); $('pinForm').reset(); message('PIN changed.'); }); };
run(start);
