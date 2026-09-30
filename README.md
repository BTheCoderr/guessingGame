# Guess Arcade

A local-first revival of the original Number Guessing Game, rebuilt into a small browser arcade.

## v3 fun pass

The core higher/lower game is still the point, but it now has enough game systems around it to feel like an arcade instead of a demo.

### Six modes

- **Classic** — progressive levels, combos, jackpot rounds, and power-ups
- **Sprint** — solve as many targets as possible in 60 seconds
- **Survival** — four misses costs a life; the run ends when all lives are gone
- **Endless** — the number range keeps expanding
- **Daily** — one date-seeded target with seven guesses and no power-ups
- **Duel** — pass-the-phone two-player mode; alternate after every miss and race to three round wins

### Arcade systems

- Quick-win combo multiplier up to 2x
- Every third solo level becomes a 2x Jackpot Round
- Heat Check challenge: three quick wins earns a +100 bonus
- Three one-use Power Deck cards per run:
  - Scanner narrows the target range
  - Double Up doubles the next correct hit
  - Lucky Break gives a mode-specific bonus
- Hot / warm / cold proximity feedback and one-away callouts
- Win flashes, confetti, haptics, and arcade sound cues
- Ten achievements
- Persistent stats, records, game history, and daily results
- JSON backup and restore
- Light, dark, and system themes
- Shareable results
- Responsive mobile-first UI
- Installable PWA with offline app shell

## Local-first storage

Guess Arcade stores player data in `localStorage` under `guess-arcade-v2`. The storage key stays the same so existing v2 players keep their history and settings; new v3 stats are merged in automatically.

There is no login, cloud database, secret, or environment variable required.

## Run locally

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## Deploy

`netlify.toml` publishes the repository root directly. Netlify can deploy straight from `master`.

## Legacy route

`guessingGame.html` remains as a compatibility redirect to `index.html`.
