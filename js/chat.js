import { getView } from './input.js';
// Chat input box (a real text field so Korean typing works). Enter sends, Esc closes.
let box = null, field = null, onSend = null;

function build() {
  box = document.createElement('div');
  box.id = 'chatbox';
  box.innerHTML = '<input id="chatfield" type="text" maxlength="80" autocomplete="off" placeholder="메시지 입력 후 Enter (닫기 Esc)">';
  document.body.appendChild(box);
  field = box.querySelector('input');
  field.addEventListener('keydown', (e) => {
    e.stopPropagation();
    // while Korean letters are still being composed, Enter only finishes the letter; don't send twice
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = field.value.trim();
      field.value = '';
      if (v && onSend) onSend(v);
      close();
    } else if (e.key === 'Escape') { e.preventDefault(); field.value = ''; close(); }
  });
  field.addEventListener('keyup', (e) => e.stopPropagation());
  field.addEventListener('blur', () => setTimeout(close, 0));
}

// at: optional rect in game coordinates (1280x720) to place the field over; default is bottom center
// The canvas fills the whole window and letterboxes inside itself, so use the game view (scale + offset), not the canvas box.
let anchor = null;
function place() {
  if (!box) return;
  if (anchor) {
    const v = getView();
    Object.assign(box.style, { left: (v.ox + anchor.x * v.scale) + 'px', top: (v.oy + anchor.y * v.scale) + 'px', bottom: 'auto', width: (anchor.w * v.scale) + 'px', transform: 'none' });
  } else Object.assign(box.style, { left: '50%', top: 'auto', bottom: '18px', width: '', transform: 'translateX(-50%)' });
}
window.addEventListener('resize', place);
export function openChat(send, at = null) {
  if (!box) build();
  onSend = send; anchor = at;
  place();
  box.style.display = 'block';
  setTimeout(() => field.focus(), 0);
}
export function close() { if (box) { box.style.display = 'none'; field.blur(); } }
export function chatOpen() { return !!box && box.style.display === 'block'; }
