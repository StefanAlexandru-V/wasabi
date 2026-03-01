import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SignInButton } from "@/components/sign-in-button";
import { Dashboard } from "@/components/dashboard";
import { ErrorBoundary } from "@/components/error-boundary";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-8 sm:p-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-wasabi/[0.06] blur-[120px]" />
          <div className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 h-[400px] w-[400px] rounded-full bg-warning/[0.04] blur-[100px]" />
        </div>

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(74,222,128,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(74,222,128,0.015)_1px,transparent_1px)] bg-[size:64px_64px]" />

        <div className="relative z-10 flex flex-col items-center space-y-8 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-2">
            <div className="relative flex h-10 w-10 items-center justify-center animate-wasabi-glow rounded-xl">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-wasabi to-wasabi-light opacity-20 blur-sm" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 border border-border-default">
                <svg width="20" height="20" viewBox="0 0 32 32" fill="none" className="text-wasabi">
                  <path d="M16 4c-5 5-9 10-9 16a9 9 0 0018 0c0-6-4-11-9-16z" fill="currentColor" opacity="0.85"/>
                  <path d="M16 8v14M13 13l3-2 3 2M13 17.5l3-1.5 3 1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.35"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="text-center space-y-3 max-w-lg">
            <h1 className="text-4xl sm:text-5xl text-gradient text-brand">
              Wasabi
            </h1>
            <p className="text-text-secondary text-base sm:text-lg leading-relaxed max-w-md mx-auto">
              Find the rot before it spreads. Surface neglected repos and keep your GitHub organization healthy.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 pt-2">
            <SignInButton />
            <p className="text-text-quaternary text-xs">
              Read-only access &middot; No code stored &middot; SOC 2 ready
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-6 text-text-tertiary text-xs sm:text-sm">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="sm:w-4 sm:h-4">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>7-factor scoring</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="sm:w-4 sm:h-4">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Instant results</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="sm:w-4 sm:h-4">
                <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Secure by default</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const [orgs, subscription] = await Promise.all([
    prisma.organization.findMany({
      where: { ownerUserId: session.user.id },
      include: {
        scans: {
          orderBy: { startedAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.subscription.findUnique({
      where: { userId: session.user.id! },
    }),
  ]);

  const plan = subscription?.plan ?? "free";

  return (
    <main className="min-h-screen">
      <ErrorBoundary>
        <Dashboard
          user={{ id: session.user.id!, name: session.user.name!, image: session.user.image! }}
          orgs={orgs}
          plan={plan}
        />
      </ErrorBoundary>
    </main>
  );
}
