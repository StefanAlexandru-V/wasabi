# Wasabi

Scans a GitHub org and scores each repo on a 0–17 scale based on 7 neglect signals.

https://wasabi.stefanvladu.dev

## Setup

```bash
npm install
cp .env.example .env
npx prisma generate && npx prisma db push
npm run dev
npm run inngest:dev  # background jobs
```

## Tests

```bash
npm run test:run
```
