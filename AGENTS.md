# AGENTS.md — Repo Rot Detector

## Project Overview

Micro-SaaS that ranks GitHub repositories by "rot risk" within an organization. Computes a deterministic Rot Score (0–17) per repository using 7 factors and surfaces the most neglected repos.

## Tech Stack

- **Next.js 15** (App Router, fullstack) + **TypeScript**
- **PostgreSQL** via **Prisma** ORM
- **Auth.js** (NextAuth v5 beta) with GitHub OAuth + PrismaAdapter
- **Inngest** for background scan jobs (dev server on port 8288)
- **Stripe** Checkout + Webhooks for billing
- **Tailwind CSS v4** (`@import "tailwindcss"` + `@theme` block in globals.css)
- **Vitest 4** + React Testing Library for tests
- **Zod** for API input validation

## Commands

```bash
npm run dev              # Next.js dev server (port 3000)
npm run build            # Production build
npm run inngest:dev      # Inngest dev server (port 8288)
npx vitest run           # Run all 153 tests (21 files)
npx vitest run <path>    # Run specific test file
npx prisma generate      # Regenerate Prisma client after schema changes
npx prisma db push       # Push schema to database (no migration)
npx prisma migrate dev   # Create migration
npx prisma studio        # Database GUI
```

## Architecture

### Data Flow

1. User authenticates via GitHub OAuth → session stored in DB
2. User connects an org → `Organization` row created
3. User clicks Scan → POST `/api/scan/start` creates `Scan` row (status=queued), triggers Inngest job
4. Inngest worker fetches repos via GraphQL, checks each via REST (branch protection, CODEOWNERS, workflows, stale PRs, vulns), computes score
5. Worker persists `Repository` + `RepoScore` rows, updates scan status
6. Frontend connects to SSE endpoint `/api/scan/[id]/stream` for real-time progress
7. On completion, results displayed in ranked table

### Key Patterns

- **API routes**: All use `getAuthenticatedUser()` from `@/lib/api-utils` for auth guard. Return `unauthorized()` (401), `badRequest()` (400), `serverError()` (500). UUID validation via `validateUUID()` (Zod).
- **Dynamic route params**: Next.js 15 async params pattern: `{ params }: { params: Promise<{ id: string }> }`
- **SSE**: `ReadableStream` with 2-second DB polling. Auto-closes on completion/failure. 5-minute timeout.
- **Share tokens**: `crypto.randomBytes(24).toString("base64url")` stored as `@unique` on Scan model
- **Token encryption**: AES-256-GCM with random IVs for GitHub access tokens at rest
- **Rate limiting**: Batch repos in groups of 20, respect `X-RateLimit-Remaining`, sleep until reset if low

### Data Model

```
User → has many Organizations, has one Subscription
Organization → has many Scans, Repositories
Scan → has many RepoScores, has optional shareToken
Repository → has many RepoScores
RepoScore → belongs to Scan + Repository, stores scoreTotal + scoreBreakdown (JSONB) + severity
Subscription → tracks Stripe customer/subscription, plan (free/pro), status
```

### Billing Logic

- **Free**: 1 org, 20 repos/scan, 1 scan/24h
- **Pro** (€29/month): unlimited orgs, repos, scans, CSV export
- Plan checked via `getUserPlan()` → queries `Subscription` table

## Testing Patterns

- **Mock setup**: Centralized in `src/__tests__/helpers/mocks.ts` with `vi.mock()` hoisting for prisma, auth, inngest, github, encryption
- **Helpers**: `setAuthenticatedUser()`, `setUserPlan()`, `resetMocks()`, `TEST_IDS` (deterministic UUIDs)
- **API tests**: Direct route handler invocation — `GET(req, ctx)` / `POST(req, ctx)` — no HTTP server. Params via `{ params: Promise.resolve({ id }) }`
- **Component tests**: JSDOM environment, `vi.mock("next/image")`, `MockEventSource` class, `Notification` mock with `permission: "denied"`
- **Fetch mocks in dashboard**: `setupFetchMock` patterns sorted by URL length (longest first) to avoid collisions
- **Convention**: Every describe starts with `it("returns 401 when unauthenticated")`. Then 400 → 404 → business logic → success path.

## File Locations

| What | Where |
|------|-------|
| Main dashboard component | `src/components/dashboard.tsx` (~1800 lines) |
| Results table | `src/components/results-table.tsx` |
| Score breakdown panel | `src/components/score-panel.tsx` |
| Skeleton loaders | `src/components/skeletons.tsx` |
| Rot score calculation | `src/lib/rot-score.ts` |
| GitHub API helpers | `src/lib/github.ts` |
| Auth config | `src/lib/auth.ts` |
| API route helpers | `src/lib/api-utils.ts` |
| Inngest scan worker | `src/inngest/functions.ts` |
| Prisma schema | `prisma/schema.prisma` |
| Test mocks | `src/__tests__/helpers/mocks.ts` |
| API tests | `src/app/api/__tests__/*.test.ts` |
| Component tests | `src/components/__tests__/*.test.tsx` |
| Global CSS + theme | `src/app/globals.css` |

## Current UI State

The dashboard is currently a single-page monolith. All features live in `dashboard.tsx`:
- Org selector + action toolbar
- 4 stat KPI cards
- Org Health Overview panel (top rot factors, score distribution)
- Results table with sorting, filtering, pagination, row selection
- Score breakdown side panel
- Collapsible scan history + compare section
- Cross-org search overlay
- Scan diff panel
- SSE progress indicator
- Share/revoke functionality
- Mobile hamburger menu
- Confetti on first scan completion

**Next planned work**: Refactor to tab-based layout (Overview | Repositories | History) for better UX — see Option C in the audit.

## Security Notes

- All secrets via `process.env`, none hardcoded
- GitHub tokens encrypted at rest (AES-256-GCM)
- `shareToken` is the only public/unauthenticated endpoint
- No source code cloned or stored
- OAuth scopes: `read:org`, `repo` (read-only)
- Security headers set in `next.config.ts` (X-Content-Type-Options, X-Frame-Options, etc.)
