# Guess Arcade

[![CI](https://github.com/BTheCoderr/guessingGame/actions/workflows/validate.yml/badge.svg)](https://github.com/BTheCoderr/guessingGame/actions/workflows/validate.yml)

**Live app:** https://guess-arcade.netlify.app

<!-- repo-intro:start -->
**Project snapshot:** Guess Arcade is a local-first browser game suite that evolves a basic number-guessing exercise into solo, competitive, daily, challenge-link, and local tournament play.

**What it demonstrates:** JavaScript · Express · PWA/offline · local persistence · game-state design.
<!-- repo-intro:end -->

<!-- portfolio-refresh:start -->
## Product at a glance

| Area | Current build |
| --- | --- |
| Solo | Classic, Sprint, Survival, Endless, Daily |
| Competitive | Two-player Duel + local 3–6 player tournaments |
| Replayability | Deterministic challenge codes/links, achievements, streaks, local history |
| Systems | Power-ups, combo multipliers, Jackpot, Heat Check |
| Persistence | Local profiles, stats, settings, backup/restore |
| Delivery | Installable offline PWA with no account/backend requirement |

### Engineering angle

Guess Arcade intentionally proves that a small browser game can gain deterministic challenges, tournament state, profiles, persistence, sharing, and offline support **without pretending it needs a hosted backend**. Shared challenge state is encoded into reproducible local game configuration instead.
<!-- portfolio-refresh:end -->

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
- **Local leaderboard** — rank saved players by hits, tournament wins, score, perfect guesses, and fastest solves
- **Daily streaks** — track current/best completion streaks with a rolling seven-day view
- **Custom games** — choose range, guess limit, timer, hints, Power Deck, and jackpot finish
- **Challenge Codes + Links** — deterministic challenges can be copied as codes or opened directly through a shareable `?challenge=` link; no server required
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
