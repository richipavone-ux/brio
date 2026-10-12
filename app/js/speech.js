// Thin wrapper over the Web Speech API (Safari on iOS supports it when Siri is enabled).
import { S } from './ctx.js';

const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = () => !!Rec;

let current = null;

export function listen({ onPartial, onFinal, onError }) {
  stop();
  if (!Rec) { onError?.('unsupported'); return; }
  const r = new Rec();
  r.lang = S.settings.lang === 'it' ? 'it-IT' : 'en-US';
  r.interimResults = true;
  r.continuous = false;
  let finalText = '';
  r.onresult = (e) => {
    let text = '';
    for (const res of e.results) text += res[0].transcript;
    if (e.results[e.results.length - 1].isFinal) finalText = text;
    onPartial?.(text);
  };
  r.onerror = (e) => { current = null; onError?.(e.error || 'error'); };
  r.onend = () => { if (current === r) { current = null; if (finalText) onFinal?.(finalText); else onError?.('nothing'); } };
  current = r;
  try { r.start(); } catch { current = null; onError?.('error'); }
}

export function stop() {
  if (current) { const r = current; current = null; try { r.abort(); } catch { /* already stopped */ } }
}
