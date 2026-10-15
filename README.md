# Racing Simulator

A 2026-season F1 racing game that runs in the browser. Pick a circuit from the calendar, choose your driver and race a full grid of AI cars.

**Play:** https://lilbodnar.github.io/racing-simulator/

## Controls

| Key | Action |
|---|---|
| ↑ / W | Throttle |
| ↓ / S | Brake (hold when stopped to reverse) |
| ← → / A D | Steer |
| M | Switch automatic / manual gearbox |
| Q / E | Shift down / up (switches to manual; any gear at any speed, no rev limiter) |
| Space | Overtake mode (within 1 s of the car ahead) |
| C | Change camera |
| R | Rejoin behind the last car (full-grid race) |
| N | Sound on/off |
| Esc | Pause |

Steering wheels, pedals, H-shifters and game controllers are supported too.

## Phones and tablets

Open the link on your phone and it shows on-screen controls: tilt the phone like a steering wheel to steer, BRAKE on the left, GAS and OVERTAKE on the right, plus pause, camera and rejoin buttons.

To install it as an app with its own home-screen icon, which opens full screen:

- **iPhone / iPad (Safari):** Share → **Add to Home Screen**
- **Android (Chrome):** ⋮ menu → **Add to Home screen** or **Install app**

Once installed it also works offline for single-player races.

## Multiplayer

Race up to 22 people, one per car on the grid.

1. One player clicks **Multiplayer**, enters a name and clicks **Host a race**. They get a 5-letter room code.
2. Everyone else clicks **Multiplayer** and enters the code, or opens the invite link the host copies.
3. Each player clicks a free car. The host picks the track, the weather, and whether AI drivers fill the empty seats.
4. The host clicks **Start race**. The lights wait until everyone has loaded the circuit.

Browsers connect directly to each other (WebRTC via PeerJS), so there's no game server. PeerJS's free public service only introduces the browsers to each other. The host's browser runs the AI cars and passes everyone's positions on, so the host should keep the tab open until the race ends. Pausing an online race only opens the menu; the race keeps going.

## Records and accounts

Your fastest lap and best race time on each circuit are saved on the device you play on.

Sign in from the main menu, using a username and password, to keep your records in an account instead. While you're signed in, the account's records show and new ones are saved to it, so they follow you to any device or browser. Sign out and the device's own records come back. A new account starts with the records already on the device you create it on.

There's no password reset, because accounts have no email address.

### Setting up accounts (one time)

Accounts use [Firebase](https://firebase.google.com/), which is free at this size. Until it's set up, the sign-in button doesn't appear and records are saved per device.

1. Go to the [Firebase console](https://console.firebase.google.com/), click **Create a project**, and give it a name. Google Analytics isn't needed.
2. **Build → Authentication → Get started → Sign-in method**: turn on **Email/Password**.
3. **Build → Firestore Database → Create database**: pick a location near you and start in **production mode**.
4. In Firestore, open the **Rules** tab, replace the rules with these, and click **Publish**. They let each player read and write only their own records:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

5. **Project settings** (gear icon) → **Your apps** → the web icon `</>`. Give it a nickname, then click **Register app**. Copy the `firebaseConfig` object it shows.
6. In `js/firebase-config.js`, replace `null` with that object:

   ```js
   window.FIREBASE_CONFIG = {
     apiKey: "...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     // ...the rest of what Firebase showed you
   };
   ```

7. Commit and push. The config isn't secret, so it's fine for it to be public on GitHub; the rules from step 4 are what protect the records.

Signing in needs an internet connection and the published site (or a local web server), not `index.html` opened straight from disk.

## Features

- All 2026 calendar circuits, built from real track layouts with elevation
- Full 22-car grid with AI that follows, waits for gaps and overtakes
- Grass, gravel and sand run-off, kerbs, dirty tyres
- 2026-style track limits: black-and-white flag on the 3rd offence, 5 s penalty from the 4th
- Car-to-car contact physics, overtake mode, lap and race records saved on the device or to an account
- Weather: sunny, cloudy, rainy, snowy or hurricane (gale-force gusts, lightning strikes and flying debris)
- Online multiplayer for up to 22 drivers, with AI filling the empty seats if you want

## Running locally

No build step. Open `index.html` in a browser.

## Credits

- [three.js](https://threejs.org/) (MIT licence) for 3D rendering
- [PeerJS](https://peerjs.com/) (MIT licence) for browser-to-browser multiplayer
- Circuit layouts from [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT licence)

This is a fan project and isn't affiliated with Formula 1 or any team.
