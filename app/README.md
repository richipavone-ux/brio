# Brio · web app (PWA)

The working version of **Brio Redesign**, rounds 4–6: the orb with its gestures, the meal log step by step, Memory, the customization presets, insulin on board and the hypo alerts. English and Italian.

It is a static web app with no build step and no dependencies at runtime. Installed on iPhone (Share → Add to Home Screen) it opens full screen like a native app and works offline. All data stays in the phone's local storage.

## Run it

```sh
cd app
npx http-server -p 8765 -c-1 .     # or: npm install && npm start
```

Open http://localhost:8765. On a desktop it shows inside a phone frame; on a phone it fills the screen.

- `?at=13:42` starts the clock at that time today. Combined with **Settings → Load an example day** (or "Just look around with an example day" on first launch) you get the pizza day from the designs: pizza at 13:10, second dose at 14:40.
- Camera, notifications and the service worker need **HTTPS** (or `localhost`).

## Put it online

Upload the `app/` folder to any static host with HTTPS (GitHub Pages, Netlify, Cloudflare Pages, Vercel…). No server code is needed. When you change files, bump `VERSION` in `sw.js` so installed copies update.

## What's in it, mapped to the designs

| Design | Where |
|---|---|
| 4a Home · Simple preset, "what matters now" card | `js/views/home.js` |
| 4b Orb gestures: tap, double tap, hold (ring fills), swipe up | `js/main.js` (gesture engine) |
| 4c Meal detail with one chart; Memory with progress rings | `js/views/meal.js`, `js/views/memory.js` |
| 4d Presets, home switches, gesture remapping | `js/views/settings.js` |
| 5a New meal → photo / say it / type it → "Is this right?" → "Your dose" | `js/views/mealflow.js` |
| 5b Timeline on home, checks, meal closed with peak / in range / vs forecast | `js/views/home.js`, `js/views/meal.js` |
| 6a IOB ring and sheet, correction protected from stacking | `js/views/glucose.js` |
| 6b Heading low, urgent low, guided 15-minute rule, alert settings | `js/views/hypo.js`, `js/views/settings.js` |
| 1d Onboarding: one number per screen | `js/views/onboarding.js` |
| 3b "It was only half": Brio shows before/after and recalculates | `js/views/talk.js` |

The other files:

- `js/calc.js`: dose maths, insulin on board (exponential action curve), glucose forecast.
- `js/brain.js`: the agenda (doses and checks due), the sentence under the orb, low detection.
- `js/store.js`: settings, persistence and the example day.
- `js/foods.js`: built-in food library (bilingual), search, free-text parsing, learned foods.
- `js/lang-it.js`: Italian; English text is the key.

## Decisions I made where the designs were open

- **Every treatment number is a setting**, set at first launch and changeable in Memory → Numbers. Changes ask you to confirm twice, as in 1d. The design's examples (carb ratio 10, sensitivity 40, goal 110, 4 h, split at 20 g of fat with 40% first, second part after 90 min, ½ U pen, 15 U max) are only the defaults. **They must be set with the care team.**
- **IOB is subtracted from every new dose**, as 6a says. A fresh high reading always opens the correction sheet, which suggests waiting when the insulin still working already covers it.
- **Hold** defaults to "Your week" (4a and 4b). 4d showed "Talk to Brio" on hold; that is one tap away in gesture remapping.
- **The IOB ring is shown in Simple too**, following round 6 (which came after 4d).
- The dose split happens when fat ≥ the threshold and the dose is at least 4 pen steps. The low alert triggers when the 20-minute forecast falls under the threshold (higher at night). After treatment, Brio stops at max(low + 10, 80).
- The forecast is a simple model (carbs absorbing, insulin acting, recent trend). It drives the dashed line and the "heading low" warning. It is not a CGM algorithm.

## What a web app can't do on iPhone

These parts of the designs need the native iOS app:

- **Live Activity, Dynamic Island, widgets, StandBy, Action button / Siri** (round 3) aren't available to web apps. The "Live Activity" switch from 4d is left out.
- **Notifications** arrive while Brio is open or recently in the background. A web app on iOS can't schedule them for later with the app closed: that needs a push server or the native app.
- **Urgent low**: a web app can't ring through silent mode or Focus, and can't send a message by itself. Brio rings while the screen is open. After 10 minutes without an answer it prepares an SMS to the emergency contact with your glucose (and location, if you allow it) for you to send.
- **Reading the plate from a photo** needs a vision model and a server. Today the photo is attached to the meal and you add what's on the plate by searching. Voice uses Safari's speech recognition, which needs Siri enabled; there's always a text fallback.
- **No sensor connection**: glucose is typed in or said. The designs' "from sensor" becomes "from your last reading".

## Tests

`tests/flows.test.mjs` drives the real app in Chromium and checks the stored data: onboarding, half-portion meal with manual glucose, confirm-twice settings, gesture remapping, moving the second dose, "it was only half", hold menu, meal and food edits, keyboard gestures, urgent low SMS, persistence after reload.

```sh
npm install && npx playwright install chromium
npm start          # terminal 1
npm test           # terminal 2 (SHOTS=shots npm test also saves screenshots)
```

## Medical note

Brio is a support tool, not a medical device. It never logs a dose on its own, and the app says this on the dose screen, during onboarding and in Settings. Before real use, the dose logic and the alert thresholds should be reviewed by a clinician.
