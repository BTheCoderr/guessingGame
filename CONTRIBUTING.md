# Contributing to Guess Arcade

Guess Arcade is currently maintained as a focused product/portfolio project.

## Product scope

Keep changes aligned with the existing product direction and stack:

**JavaScript · Express · localStorage · PWA/offline**

Prefer changes that improve reliability, accessibility, security, product clarity, or the core user workflow over feature sprawl.

## Before opening a pull request

Follow the setup and validation commands documented in the README. At minimum:

- install dependencies from the lockfile when present
- run the repository's existing tests / validation workflow
- run a production build when the project has one
- check mobile and desktop behavior for UI changes
- verify persistence, auth, or migration behavior when those areas change

## Data and secrets

Do not commit real credentials, production secrets, private user data, or generated local database files.

## Pull requests

Explain what changed, why, and how it was verified. Keep unrelated cleanup separate from functional changes when possible.

A merged commit is not automatic approval for a production deploy.
