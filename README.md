# Guess Arcade

A polished local-first revival of the original Number Guessing Game.

The original project was a small HTML/CSS/JavaScript experiment with one guessing loop. Version 2 keeps that mechanic and turns it into a responsive arcade that works without accounts, cloud storage, or a database.

## v2 features

- Five modes: Classic, Sprint, Survival, Endless, and Daily
- Progressive number ranges and level-based scoring
- Hot / warm / cold feedback plus higher / lower signals
- Hints, timers, lives, and seven-guess daily rules depending on mode
- Date-seeded daily challenge
- Persistent player stats, game history, win streaks, and records
- Six unlockable achievements
- Light, dark, and system themes
- Optional sound and haptic feedback
- JSON backup and restore
- Shareable results
- Responsive mobile-first interface
- Installable PWA with an offline app shell
- No account system or database required

## Storage

Guess Arcade stores gameplay data in `localStorage` under `guess-arcade-v2`.

That includes:

- stats and records
- recent game history
- unlocked achievements
- daily challenge results
- theme, sound, and haptic preferences

Data stays on the device unless the player exports a JSON backup.

## Run locally

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

Because the app is static, it can also be served by any static web server.

## Deploy

`netlify.toml` publishes the repository root directly. No environment variables, database, or secrets are required.

## Legacy route

`guessingGame.html` is retained as a compatibility redirect to the new `index.html` experience.
