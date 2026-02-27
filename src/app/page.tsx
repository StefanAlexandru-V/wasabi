import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SignInButton } from "@/components/sign-in-button";
import { Dashboard } from "@/components/dashboard";
import { ErrorBoundary } from "@/components/error-boundary";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-accent/[0.07] blur-[120px]" />
          <div className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 h-[400px] w-[400px] rounded-full bg-danger/[0.05] blur-[100px]" />
        </div>

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

        <div className="relative z-10 flex flex-col items-center space-y-8 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-2">
            <div className="relative flex h-10 w-10 items-center justify-center">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-accent to-accent/60 opacity-20 blur-sm" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 border border-border-default">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-accent">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="text-center space-y-3 max-w-lg">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gradient leading-tight">
              Repo Rot Detector
            </h1>
            <p className="text-text-secondary text-base sm:text-lg leading-relaxed max-w-md mx-auto">
              Find neglected repositories, surface hidden risks, and keep your GitHub organization healthy.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 pt-2">
            <SignInButton />
            <p className="text-text-quaternary text-xs">
              Read-only access &middot; No code stored &middot; SOC 2 ready
            </p>
          </div>

          <div className="flex items-center gap-6 pt-6 text-text-tertiary text-sm">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>7-factor scoring</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Instant results</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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
