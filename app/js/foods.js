// A small built-in food library (typical portions). Users can correct any number and
// add their own foods; meals they log are learned into Memory > Foods.
// [en, it, portion en, portion it, carbs, fat, protein, keywords]
const BUILTIN = [
  ['Pizza margherita', 'Pizza margherita', 'Whole · ~320 g', 'Intera · ~320 g', 92, 34, 28, 'pizza margherita', [['Pizza base and sauce', 'Base e pomodoro', 90, 14, 20, 'Whole · ~320 g', 'Intera · ~320 g'], ['Mozzarella', 'Mozzarella', 2, 20, 8, '~110 g', '~110 g']]],
  ['Pasta al pomodoro', 'Pasta al pomodoro', '90 g dry', '90 g a crudo', 70, 5, 12, 'pasta pomodoro spaghetti penne', [['Pasta', 'Pasta', 66, 2, 11, '90 g dry', '90 g a crudo'], ['Tomato sauce', 'Sugo di pomodoro', 4, 3, 1, '100 g', '100 g']]],
  ['Pasta', 'Pasta', '90 g dry', '90 g a crudo', 66, 2, 11, 'pasta spaghetti penne fusilli rigatoni'],
  ['Risotto', 'Risotto', '1 plate', '1 piatto', 62, 12, 9, 'risotto riso'],
  ['Rice', 'Riso', '150 g cooked', '150 g cotto', 42, 0, 4, 'rice riso basmati'],
  ['Bread', 'Pane', '1 slice · 50 g', '1 fetta · 50 g', 25, 1, 4, 'bread pane toast'],
  ['Focaccia', 'Focaccia', '100 g', '100 g', 48, 10, 7, 'focaccia'],
  ['Sandwich', 'Panino', '1 roll', '1 panino', 45, 12, 18, 'sandwich panino'],
  ['Croissant', 'Cornetto', '1 piece', '1 pezzo', 36, 12, 5, 'croissant cornetto brioche'],
  ['Cappuccino', 'Cappuccino', '1 cup', '1 tazza', 9, 6, 6, 'cappuccino latte caffè'],
  ['Espresso', 'Caffè', '1 cup', '1 tazzina', 0, 0, 0, 'espresso coffee caffè'],
  ['Greek yogurt', 'Yogurt greco', '170 g', '170 g', 6, 5, 15, 'yogurt'],
  ['Granola', 'Granola', '45 g', '45 g', 32, 6, 4, 'granola muesli cereali cereal'],
  ['Corn flakes', 'Corn flakes', '30 g', '30 g', 25, 0, 2, 'cornflakes corn flakes'],
  ['Milk', 'Latte', '200 ml', '200 ml', 10, 7, 7, 'milk latte'],
  ['Biscuits', 'Biscotti', '4 pieces', '4 biscotti', 28, 8, 3, 'biscuits cookies biscotti'],
  ['Apple', 'Mela', '1 medium', '1 media', 20, 0, 0, 'apple mela'],
  ['Banana', 'Banana', '1 medium', '1 media', 27, 0, 1, 'banana'],
  ['Orange', 'Arancia', '1 medium', '1 media', 15, 0, 1, 'orange arancia'],
  ['Pear', 'Pera', '1 medium', '1 media', 22, 0, 1, 'pear pera'],
  ['Grapes', 'Uva', '150 g', '150 g', 26, 0, 1, 'grapes uva'],
  ['Orange juice', 'Succo d\'arancia', '200 ml', '200 ml', 20, 0, 1, 'juice succo'],
  ['Coca-Cola', 'Coca-Cola', '33 cl', '33 cl', 35, 0, 0, 'coca cola coke'],
  ['Coca-Cola Zero', 'Coca-Cola Zero', '33 cl', '33 cl', 0, 0, 0, 'zero diet light'],
  ['Beer', 'Birra', '33 cl', '33 cl', 12, 0, 1, 'beer birra'],
  ['Potatoes', 'Patate', '200 g', '200 g', 34, 0, 4, 'potatoes patate'],
  ['Fries', 'Patatine fritte', 'Medium', 'Media', 44, 17, 4, 'fries patatine'],
  ['Burger', 'Hamburger', '1 burger', '1 hamburger', 32, 25, 28, 'burger hamburger'],
  ['Salad', 'Insalata', '1 bowl', '1 ciotola', 6, 8, 2, 'salad insalata'],
  ['Chicken breast', 'Petto di pollo', '150 g', '150 g', 0, 4, 34, 'chicken pollo'],
  ['Fish', 'Pesce', '150 g', '150 g', 0, 6, 30, 'fish pesce salmone tonno'],
  ['Eggs', 'Uova', '2 eggs', '2 uova', 1, 10, 12, 'eggs uova'],
  ['Legumes', 'Legumi', '150 g cooked', '150 g cotti', 24, 1, 10, 'beans lentils chickpeas legumi lenticchie ceci fagioli'],
  ['Lasagne', 'Lasagne', '1 portion', '1 porzione', 45, 22, 24, 'lasagne lasagna'],
  ['Gelato', 'Gelato', '2 scoops', '2 palline', 30, 10, 4, 'gelato ice cream'],
  ['Tiramisù', 'Tiramisù', '1 portion', '1 porzione', 35, 20, 6, 'tiramisu tiramisù'],
  ['Chocolate', 'Cioccolato', '20 g', '20 g', 11, 7, 1, 'chocolate cioccolato'],
  ['Glucose tablets', 'Tavolette di glucosio', '3 tablets', '3 tavolette', 15, 0, 0, 'glucose tablets tavolette zucchero sugar'],
  ['Sushi', 'Sushi', '8 pieces', '8 pezzi', 48, 6, 14, 'sushi'],
  ['Piadina', 'Piadina', '1 piadina', '1 piadina', 50, 18, 16, 'piadina wrap'],
];

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function itemOf(name, carbs, fat, protein, portion) {
  return { name, carbs, fat, protein, portion, base: { carbs, fat, protein }, mult: 1 };
}

export function library(state) {
  const lang = state.settings.lang;
  const out = BUILTIN.map((b) => ({
    key: 'b:' + b[0],
    name: lang === 'it' ? b[1] : b[0],
    portion: lang === 'it' ? b[3] : b[2],
    carbs: b[4], fat: b[5], protein: b[6],
    words: norm(b[0] + ' ' + b[1] + ' ' + b[7]),
    parts: b[8] ? b[8].map((p) => itemOf(lang === 'it' ? p[1] : p[0], p[2], p[3], p[4], lang === 'it' ? p[6] : p[5])) : null,
    builtin: true,
  }));
  for (const f of state.foods) {
    out.unshift({ key: 'u:' + f.id, id: f.id, name: f.name, portion: f.portion || '', carbs: f.carbs, fat: f.fat, protein: f.protein, words: norm(f.name), parts: f.parts || null, builtin: false });
  }
  return out;
}

export function search(state, q, limit = 6) {
  const n = norm(q).trim();
  if (!n) return [];
  const words = n.split(/\s+/);
  return library(state)
    .map((f) => {
      const name = norm(f.name);
      let score = 0;
      if (name === n) score += 10;
      if (name.startsWith(n)) score += 5;
      for (const w of words) if (w.length > 1 && (f.words.includes(w) || name.includes(w))) score += 2;
      return { f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.f);
}

export function itemsFromFood(f) {
  if (f.parts) return f.parts.map((p) => ({ ...p, base: { ...p.base } }));
  return [itemOf(f.name, f.carbs, f.fat, f.protein, f.portion)];
}

// Turn free text ("pizza, the whole thing", "mezza pasta e una mela") into items.
export function parseMeal(state, text) {
  const n = norm(text);
  const chunks = n.split(/,|\be\b|\band\b|\bwith\b|\bcon\b|\+/).map((c) => c.trim()).filter(Boolean);
  const items = [];
  let portion = 1;
  if (/\b(half|meta|mezz[ao])\b/.test(n)) portion = 0.5;
  else if (/\b(quarter|quarto)\b/.test(n)) portion = 0.25;
  else if (/\b(three quarters|tre quarti)\b/.test(n)) portion = 0.75;
  for (const c of chunks) {
    const hit = search(state, c.replace(/\b(the|whole|thing|a|an|un|una|uno|tutta|tutto|intera|half|mezza|mezzo|meta|some|di|del|della|i|ate|eating|mangiato|mangio|sto|ho)\b/g, ' '), 1)[0];
    if (hit && !items.some((i) => i._key === hit.key)) items.push(...itemsFromFood(hit).map((i) => ({ ...i, _key: hit.key })));
  }
  return { items: items.map(({ _key, ...i }) => i), portion };
}

// Remember a logged meal so it is suggested next time.
export function learn(state, meal) {
  const key = norm(meal.name);
  if (!key) return;
  const lib = library(state);
  if (lib.some((f) => f.builtin && norm(f.name) === key && !meal.items.some((i) => i.edited))) return;
  const existing = state.foods.find((f) => norm(f.name) === key);
  const parts = meal.items.map((i) => itemOf(i.name, i.carbs, i.fat, i.protein, i.portion));
  const rec = {
    name: meal.name, portion: '', parts,
    carbs: meal.items.reduce((a, i) => a + i.carbs, 0),
    fat: meal.items.reduce((a, i) => a + i.fat, 0),
    protein: meal.items.reduce((a, i) => a + i.protein, 0),
  };
  if (existing) Object.assign(existing, rec);
  else state.foods.push({ id: state.nextId++, ...rec });
}
