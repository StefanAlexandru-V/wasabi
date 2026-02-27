# Repo Rot Detector

Scans a GitHub org and scores each repo on a 0–17 scale based on 7 neglect signals (inactivity, vulns, missing CODEOWNERS, no branch protection, stale PRs, no CI, should-be-archived).

## Setup

```bash
npm install
cp .env.example .env
npx prisma generate && npx prisma db push
npm run dev
```

Inngest dev server (background jobs): `npm run inngest:dev`

## Tests

```bash
npm run test:run
```
