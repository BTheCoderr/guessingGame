# Guess Arcade

A local-first revival of the original Number Guessing Game, rebuilt into a browser arcade with solo, competitive, and party play.

## v4 Party Lab

The final expansion adds replay and social features without adding accounts or a backend.

### Core arcade
- Classic, Sprint, Survival, Endless, Daily, and two-player Duel
- Combo multipliers, Jackpot rounds, Heat Check bonuses
- Scanner, Double Up, and Lucky Break power-ups
- Hot / warm / cold feedback, one-away callouts, sound, haptics, confetti
- Achievements, local stats, history, themes, sharing, JSON backup/restore
- Installable PWA with offline support

### Party Lab
- **Local player profiles** — save up to six names and keep local records
- **Custom games** — choose range, guess limit, timer, hints, Power Deck, and jackpot finish
- **Challenge Codes** — compact deterministic codes recreate the same range, rules, and target on any device; no server required
- **Tournament mode** — choose 3–6 saved players, 1–5 rounds, range, and guess limit
  - each player gets a private deterministic target at equal difficulty
  - fewer guesses earns more tournament points
  - local tournament wins are tracked per profile

## Storage

Guess Arcade stores data in `localStorage` under `guess-arcade-v2`.

The key intentionally stays unchanged so v2/v3 players retain their history. v4 merges in profiles, challenge stats, and tournament stats automatically.

No authentication, cloud database, secrets, or environment variables are required.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Deploy

`netlify.toml` publishes the repository root. Netlify deploys automatically from `master`.

## Legacy route

`guessingGame.html` remains a compatibility redirect to `index.html`.
