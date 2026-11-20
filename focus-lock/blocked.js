import {send, $, message, pinInput} from './ui.js';
let target;
try { const u = new URL(location.hash.slice(1)); if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) throw Error(); target = u.href; $('host').textContent = u.hostname; } catch { $('unlockForm').hidden = true; message('Open settings to manage your blocked websites.'); }
pinInput($('pin'));
$('settings').onclick = () => chrome.runtime.openOptionsPage();
$('unlockForm').onsubmit = async e => {
  e.preventDefault(); const button = e.submitter; button.disabled = true;
  try { const result = await send('unlock', {pin: $('pin').value, url: target}); location.replace(result.url); }
  catch (err) { message(err.message, true); $('pin').value = ''; }
  finally { button.disabled = false; }
};
send('status').then(s => { if (!s.configured) { $('unlockForm').hidden = true; $('setupNote').textContent = 'Create your PIN in protected settings to enable temporary website access.'; } }).catch(e => message(e.message, true));
