// End-to-end checks of the main flows. Run with the app served on BRIO_URL (default http://localhost:8765/):
//   npm start   (in one terminal)
//   npm test    (in another)
// Set SHOTS=dir to also save screenshots.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BRIO_URL || 'http://localhost:8765/';
const out = process.env.SHOTS || '';
if (out) mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + ' ' + e.stack));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('dialog', (d) => d.accept());
let i = 0, fails = 0;
const shot = async (n) => { await page.waitForTimeout(300); if (out) await page.screenshot({ path: `${out}/${String(++i).padStart(2, '0')}-${n}.png` }); };
const act = async (a, nth = 0) => { await page.locator(`[data-act="${a}"]`).nth(nth).click(); await page.waitForTimeout(150); };
const S = () => page.evaluate(() => JSON.parse(JSON.stringify(window.brio.S)));
const check = (cond, msg) => { if (!cond) { fails++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

await page.goto(`${BASE}?at=13:42`); await page.evaluate(() => localStorage.clear());
await page.goto(`${BASE}?at=13:42`);
// Onboarding with real numbers
await act('onbNext');
await shot('onb-icr');
await act('step', 1); await act('step', 1); // 10 -> 11
await act('onbNext');
await page.locator('[data-k="isf"]').fill('45');
await act('onbNext'); await act('onbNext'); await act('onbNext');
await shot('onb-safety');
await act('onbDone');
let s = await S();
check(s.settings.icr === 11 && s.settings.isf === 45 && s.settings.onboarded, 'onboarding stores ICR 11 / ISF 45');
await shot('home-empty');

// New meal by typing, with portion half
await page.locator('[data-orb]').dblclick(); await page.waitForTimeout(300);
await page.locator('[data-act="mealVia"][data-via="type"]').click();
await page.locator('[data-k="q"]').fill('risotto');
await page.locator('[data-act="addFood"]').first().click();
await page.locator('[data-k="q"]').fill('my granny cake');
await page.locator('[data-act="addManual"]').click();
await page.locator('.item-carbs input').nth(1).fill('30');
await page.locator('[data-act="portion"][data-p="0.5"]').click();
await shot('review-half');
await act('reviewOk');
await page.locator('[data-k="bg"]').fill('150'); await page.waitForTimeout(600);
await shot('dose-manual-bg');
await act('doseTook');
s = await S();
const m = s.logs.find((l) => l.kind === 'meal');
check(m && m.carbs === 46 && m.portion === 0.5, `meal logged with half portion (carbs ${m?.carbs})`);
check(s.logs.some((l) => l.kind === 'bg' && l.v === 150), 'manual glucose before meal logged');
check(m.doses.length === 1 && m.doses[0].u === m.plan.now, `dose recorded ${m.doses[0]?.u} U`);
check(s.foods.some((f) => f.name === 'Risotto' || f.name.toLowerCase().includes('risotto')), 'meal learned into foods');

// Treatment plan change asks twice
await act('settings'); await act('goPlan');
await page.locator('[data-act="editNum"][data-key="icr"]').click();
await act('step', 1);
await act('numSave');
await shot('confirm-twice');
await page.locator('[data-k="checked"]').check();
await act('numConfirm');
s = await S();
check(s.settings.icr === 11.5 && s.settings.planCheckedOn, `ICR changed after confirm (${s.settings.icr})`);
// Insulin duration in hours
await page.locator('[data-act="editNum"][data-key="diaMin"]').click();
await act('step', 0); await act('numSave'); await act('numConfirm');
s = await S();
check(s.settings.diaMin === 210, `insulin duration 3.5 h stored as ${s.settings.diaMin} min`);
await act('home');

// Gesture remap: double tap -> log glucose
await act('settings'); await act('goGestures');
await page.locator('[data-act="gEdit"][data-g="double"]').click();
await page.locator('[data-act="gSet"][data-a="glucose"]').click();
s = await S();
check(s.settings.gestures.double === 'glucose', 'double tap remapped to glucose');
await act('back'); await act('home');
await page.locator('[data-orb]').dblclick(); await page.waitForTimeout(400);
check(await page.locator('.bg-input').count() === 1, 'double tap now opens glucose');
await page.keyboard.press('Escape');

// Example day: second dose change + only half
await act('settings'); await act('loadExample'); await act('home');
await page.locator('[data-orb]').click(); await page.waitForTimeout(450);
await act('changeLater');
await shot('later-dose');
await act('laterMove');
s = await S();
let pizza = s.logs.find((l) => l.kind === 'meal' && /Pizza/.test(l.name));
check(new Date(pizza.laterAt).getHours() === 14 && new Date(pizza.laterAt).getMinutes() === 55, 'second dose moved to 14:55');
await page.evaluate(() => window.brio.runAction('talk')); await page.waitForTimeout(300);
await page.locator('.talk-form input').fill('era solo mezza pizza');
await page.locator('.talk-form button').click(); await page.waitForTimeout(300);
await shot('talk-half');
s = await S();
pizza = s.logs.find((l) => l.kind === 'meal' && /Pizza/.test(l.name));
check(pizza.carbs === 46 && pizza.plan.later < 5.5, `half pizza: carbs ${pizza.carbs}, later ${pizza.plan.later} U`);
await page.locator('.talk-form input').fill('glucose 140');
await page.locator('.talk-form button').click(); await page.waitForTimeout(300);
s = await S();
check(s.logs.some((l) => l.kind === 'bg' && l.v === 140), 'talk logs glucose 140');
await page.keyboard.press('Escape');

// Camera fallback
await page.evaluate(() => window.brio.runAction('meal')); await page.waitForTimeout(300);
await page.locator('[data-act="mealVia"][data-via="photo"]').click(); await page.waitForTimeout(600);
await shot('camera');
await act('camCancel');

// Memory: hold a meal, edit a meal, foods
await page.evaluate(() => window.brio.runAction('memory')); await page.waitForTimeout(300);
await act('memTab', 0); await shot('memory');
const row = page.locator('[data-hold="mealMenu"]').nth(1);
const b = await row.boundingBox();
await page.mouse.move(b.x + 40, b.y + 20); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
await page.waitForTimeout(300);
await shot('meal-menu');
check(await page.locator('.sheet').count() === 1, 'holding a meal opens its menu');
await page.locator('.sheet [data-act="favMeal"]').click(); await page.waitForTimeout(200);
s = await S();
check(s.logs.some((l) => l.favorite), 'meal marked favorite');
await page.keyboard.press('Escape');
await page.locator('[data-act="openMeal"]').first().click();
await act('editMeal');
await page.locator('.sheet [data-k="carbs"]').fill('80');
await act('saveMeal');
s = await S();
check(s.logs.some((l) => l.kind === 'meal' && l.carbs === 80), 'meal edit saved carbs 80');
await act('back');
await act('memTab', 1);
await page.locator('[data-k="foodQ"]').fill('banana'); await page.waitForTimeout(200);
await page.locator('[data-act="editFood"]').first().click();
await page.locator('.sheet [data-k="carbs"]').fill('24');
await act('saveFood');
s = await S();
check(s.foods.some((f) => f.name === 'Banana' && f.carbs === 24), 'built-in food copied and edited');
await shot('foods');

// Week + gestures by keyboard
await act('home');
await page.locator('[data-orb]').focus(); await page.keyboard.press('Alt+Enter'); await page.waitForTimeout(300);
check(await page.locator('.wk-bars').count() === 1, 'Alt+Enter on orb = hold = week');

// Low alerts: contact + urgent message after 10 min
await act('home'); await act('settings'); await act('goAlerts'); await act('editContact');
await page.locator('.sheet [data-k="name"]').fill('Giulia'); await page.locator('.sheet [data-k="phone"]').fill('+39 333 1234567');
await act('saveContact');
await shot('alerts-contact');
await act('back'); await act('home');
await act('glucose'); await page.locator('[data-k="v"]').fill('50'); await act('saveBg');
await page.evaluate(() => { window.brio.S.hypo.startedAt -= 11 * 60000; window.brio.render(); });
await page.waitForTimeout(300);
await shot('urgent-message');
const href = await page.locator('a[data-act="smsSent"]').getAttribute('href').catch(() => null);
check(href && href.startsWith('sms:+393331234567') && href.includes('50'), 'urgent low prepares SMS to Giulia');

// Persistence across reload
await page.reload(); await page.waitForTimeout(500);
s = await S();
check(s.hypo && s.hypo.phase === 'alert' && s.settings.contactName === 'Giulia', 'state persists after reload');

console.log(errors.join('\n') || 'no errors', '\nfails:', fails);
await browser.close();
process.exit(fails || errors.length ? 1 : 0);
