// English text is the key; other languages map from it. Missing strings fall back to English.
import IT from './lang-it.js';

const DICTS = { it: IT };
let current = 'en';

export const setLang = (l) => { current = DICTS[l] ? l : 'en'; document.documentElement.lang = current; };
export const lang = () => current;

export function t(key, vars) {
  let s = (current !== 'en' && DICTS[current][key]) || key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return s;
}

// Plural: tn(n, '1 log', '{n} logs')
export const tn = (n, one, other, vars = {}) => t(n === 1 ? one : other, { n, ...vars });
