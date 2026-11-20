export async function send(type, args = {}) {
  const response = await chrome.runtime.sendMessage({type, ...args});
  if (response.error) throw Error(response.error);
  return response.data;
}
export const $ = id => document.getElementById(id);
export function message(text, error = false) {
  const el = $('message'); el.textContent = text; el.className = error ? 'message error' : 'message';
}
export function pinInput(input) { input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 4); }); }
