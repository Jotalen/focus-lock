import {send, $} from './ui.js';
$('open').onclick = () => chrome.runtime.openOptionsPage();
send('status').then(s => { $('status').textContent = s.configured ? `${s.domains} custom sites blocked. ${s.videos} videos approved. Adult domain filter active.` : 'Adult domain filter active. Create your PIN to get started.'; }).catch(e => { $('status').textContent = e.message; });
