# Repo Rot Detector

A micro-SaaS that ranks GitHub repositories by "rot risk" within an organization. Given a GitHub org, it computes a deterministic **Rot Score** for each repository and returns a ranked list of the most neglected/risky repos.

## What it does

- Authenticate with GitHub OAuth
- Connect any GitHub organization (public or private)
- Scan repositories via GitHub's GraphQL + REST APIs
- Compute a 7-factor Rot Score (0–17) per repo
- Rank and display results with severity levels (low / high / severe)
- Export results as CSV (Pro plan)
- Share scan reports via public links
- Compare scans over time with diff view

## Rot Score Algorithm

Each repository starts at 0. Points are added for:

| Factor | Points | Condition |
|--------|--------|-----------|
| Inactivity | +3 | Last commit > 6 months ago |
| Critical Vulnerabilities | +4 | Open critical vulnerability alerts |
| Missing CODEOWNERS | +2 | No `CODEOWNERS` file |
| No Branch Protection | +2 | Default branch unprotected |
| Stale PRs | +2 | More than 5 open PRs older than 30 days |
| No CI | +1 | No `.github/workflows/` directory |
| Inactive & Not Archived | +3 | Not archived but no commits in 6+ months |

**Severity**: `≥10` severe, `≥7` high, else low.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: Auth.js (NextAuth v5 beta) with GitHub OAuth
- **Jobs**: Inngest for background scan orchestration
- **Payments**: Stripe Checkout + Webhooks
- **Styling**: Tailwind CSS v4
- **Testing**: Vitest + React Testing Library
- **Hosting**: Vercel-ready

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- GitHub OAuth App
- Stripe account (for billing features)

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Fill in your values in .env

# Generate Prisma client and push schema
npx prisma generate
npx prisma db push

# Start the dev server
npm run dev

# In a separate terminal, start the Inngest dev server
npm run inngest:dev
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret |
| `NEXTAUTH_SECRET` | Random secret for session encryption |
| `NEXTAUTH_URL` | App URL (http://localhost:3000 for dev) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PRICE_ID` | Stripe price ID for Pro plan |
| `TOKEN_ENCRYPTION_KEY` | 32-byte hex key for encrypting GitHub tokens at rest |
| `INNGEST_SIGNING_KEY` | Inngest signing key (optional in dev) |
| `INNGEST_EVENT_KEY` | Inngest event key (optional in dev) |

### Commands

```bash
npm run dev          # Start Next.js dev server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
npm run test         # Vitest (watch mode)
npm run test:run     # Vitest (single run)
npm run inngest:dev  # Inngest dev server
npm run db:generate  # Regenerate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Run migrations
npm run db:studio    # Open Prisma Studio
```

## Billing

| | Free | Pro (€29/month) |
|---|---|---|
| Organizations | 1 | Unlimited |
| Repos per scan | 20 | Unlimited |
| Scan frequency | 1 per 24h | Unlimited |
| CSV export | — | Yes |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/orgs` | List user's organizations |
| POST | `/api/orgs/connect` | Connect a GitHub organization |
| DELETE | `/api/orgs/[orgId]` | Delete an organization |
| GET | `/api/orgs/[orgId]/latest-scan` | Get latest scan + results |
| GET | `/api/orgs/[orgId]/scans` | Scan history |
| GET | `/api/orgs/[orgId]/stats` | Org-level aggregated statistics |
| POST | `/api/scan/start` | Start a new scan |
| GET | `/api/scan/[id]/status` | Scan status |
| GET | `/api/scan/[id]/results` | Scan results |
| GET | `/api/scan/[id]/export` | Export as CSV (Pro) |
| GET | `/api/scan/[id]/stream` | SSE scan progress |
| POST | `/api/scan/[id]/share` | Generate share token |
| DELETE | `/api/scan/[id]/share` | Revoke share token |
| GET | `/api/scan/diff` | Compare two scans |
| GET | `/api/repos/search` | Search repos across all orgs |
| GET | `/api/share/[token]` | Public shared report (no auth) |
| POST | `/api/stripe/create-checkout` | Create Stripe checkout session |
| POST | `/api/stripe/webhook` | Stripe webhook handler |
| GET | `/api/github/rate-limit` | GitHub API rate limit status |

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API route handlers
│   │   ├── orgs/           # Organization endpoints
│   │   ├── scan/           # Scan endpoints
│   │   ├── repos/          # Cross-org search
│   │   ├── share/          # Public share endpoint
│   │   ├── stripe/         # Billing endpoints
│   │   └── github/         # GitHub API proxy
│   ├── share/[token]/      # Public share page
│   ├── page.tsx            # Home / auth page
│   ├── loading.tsx         # Route transition loading
│   └── globals.css         # Tailwind + custom styles
├── components/             # React components
│   ├── dashboard.tsx       # Main dashboard (1800+ lines)
│   ├── results-table.tsx   # Sortable, filterable results table
│   ├── score-panel.tsx     # Score breakdown detail panel
│   ├── skeletons.tsx       # Loading skeleton components
│   ├── error-boundary.tsx  # Error boundary with retry
│   ├── toast.tsx           # Toast notification system
│   ├── confirm-modal.tsx   # Confirmation dialog
│   └── theme-provider.tsx  # Dark/light theme
├── inngest/                # Background job definitions
│   ├── client.ts           # Inngest client
│   └── functions.ts        # Scan worker function
├── lib/                    # Shared utilities
│   ├── auth.ts             # Auth.js configuration
│   ├── prisma.ts           # Prisma client singleton
│   ├── github.ts           # GitHub API helpers
│   ├── stripe.ts           # Stripe client
│   ├── encryption.ts       # AES-256-GCM token encryption
│   ├── rot-score.ts        # Score calculation logic
│   ├── api-utils.ts        # API route helpers
│   └── relative-time.ts    # Time formatting
└── __tests__/              # Test helpers and mocks
```

## Testing

153 tests across 21 test files covering API endpoints, components, and business logic.

```bash
npm run test:run
```

## License

Private — not open source.
