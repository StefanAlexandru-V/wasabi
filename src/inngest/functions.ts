import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import { getAccessToken } from "@/lib/api-utils";
import {
  fetchOrgRepos,
  checkBranchProtection,
  checkFileExists,
  countStalePRs,
  getLastRateLimit,
} from "@/lib/github";
import { computeRotScore } from "@/lib/rot-score";

async function sleepIfRateLimited(): Promise<void> {
  const rl = getLastRateLimit();
  if (rl && rl.remaining < 50) {
    const waitMs = Math.max(0, (rl.reset * 1000) - Date.now()) + 1000;
    const cappedWait = Math.min(waitMs, 60_000);
    console.log(`Rate limit low (${rl.remaining}/${rl.limit}), sleeping ${Math.round(cappedWait / 1000)}s`);
    await new Promise((resolve) => setTimeout(resolve, cappedWait));
  }
}

export const scanRun = inngest.createFunction(
  { id: "scan-run", retries: 2 },
  { event: "scan/run" },
  async ({ event, step }) => {
    const { scanId, orgId, orgName, userId, plan } = event.data;

    const token = await step.run("get-token", async () => {
      return getAccessToken(userId);
    });

    if (!token) {
      await step.run("mark-failed-no-token", async () => {
        await prisma.scan.update({
          where: { id: scanId },
          data: { status: "failed" },
        });
      });
      return { error: "No GitHub token" };
    }

    await step.run("mark-running", async () => {
      await prisma.scan.update({
        where: { id: scanId },
        data: { status: "running" },
      });
    });

    const maxRepos = plan === "free" ? 20 : undefined;

    let repos: Awaited<ReturnType<typeof fetchOrgRepos>>;
    try {
      repos = await step.run("fetch-repos", async () => {
        return fetchOrgRepos(token, orgName, maxRepos);
      });
    } catch (e) {
      await step.run("mark-failed-fetch", async () => {
        await prisma.scan.update({
          where: { id: scanId },
          data: { status: "failed" },
        });
      });
      return { error: `Failed to fetch repos: ${e instanceof Error ? e.message : "Unknown"}` };
    }

    await step.run("set-total-count", async () => {
      await prisma.scan.update({
        where: { id: scanId },
        data: { totalRepoCount: repos.length },
      });
    });

    const BATCH_SIZE = 20;
    const batches: typeof repos[] = [];
    for (let i = 0; i < repos.length; i += BATCH_SIZE) {
      batches.push(repos.slice(i, i + BATCH_SIZE));
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      await step.run(`process-batch-${batchIndex}`, async () => {
        for (const ghRepo of batch) {
          try {
            await sleepIfRateLimited();

            const defaultBranch = ghRepo.defaultBranchRef?.name ?? "main";

            const [hasBranchProtection, hasCodeowners, hasCI, stalePRCount] =
              await Promise.all([
                checkBranchProtection(token, orgName, ghRepo.name, defaultBranch),
                checkFileExists(token, orgName, ghRepo.name, "CODEOWNERS").then(
                  (exists) =>
                    exists
                      ? true
                      : checkFileExists(
                          token,
                          orgName,
                          ghRepo.name,
                          ".github/CODEOWNERS"
                        )
                ),
                checkFileExists(token, orgName, ghRepo.name, ".github/workflows"),
                countStalePRs(token, orgName, ghRepo.name),
              ]);

            const criticalVulnCount = (ghRepo.vulnerabilityAlerts?.nodes ?? [])
              .filter((a) => a.securityVulnerability?.severity === "CRITICAL")
              .length;

            const { scoreTotal, scoreBreakdown, severity } = computeRotScore({
              lastPushedAt: ghRepo.pushedAt ? new Date(ghRepo.pushedAt) : null,
              archived: ghRepo.isArchived,
              criticalVulnCount,
              hasCodeowners,
              hasBranchProtection,
              stalePRCount,
              hasCI,
            });

            const repo = await prisma.repository.upsert({
              where: {
                orgId_githubRepoId: {
                  orgId,
                  githubRepoId: ghRepo.id,
                },
              },
              update: {
                name: ghRepo.name,
                defaultBranch,
                archived: ghRepo.isArchived,
                pushedAt: ghRepo.pushedAt ? new Date(ghRepo.pushedAt) : null,
              },
              create: {
                orgId,
                githubRepoId: ghRepo.id,
                name: ghRepo.name,
                defaultBranch,
                archived: ghRepo.isArchived,
                pushedAt: ghRepo.pushedAt ? new Date(ghRepo.pushedAt) : null,
              },
            });

            await prisma.repoScore.upsert({
              where: {
                scanId_repoId: {
                  scanId,
                  repoId: repo.id,
                },
              },
              update: { scoreTotal, scoreBreakdown: scoreBreakdown as unknown as Record<string, number>, severity },
              create: {
                scanId,
                repoId: repo.id,
                scoreTotal,
                scoreBreakdown: scoreBreakdown as unknown as Record<string, number>,
                severity,
              },
            });

            processedCount++;
          } catch (e) {
            const msg = `Failed to process ${ghRepo.name}: ${e instanceof Error ? e.message : "Unknown"}`;
            console.error(msg);
            errors.push(msg);
          }
        }

        await prisma.scan.update({
          where: { id: scanId },
          data: { processedRepoCount: processedCount },
        });
      });
    }

    await step.run("mark-completed", async () => {
      await prisma.scan.update({
        where: { id: scanId },
        data: {
          status: "completed",
          completedAt: new Date(),
          repoCount: processedCount,
        },
      });
    });

    return { success: true, repoCount: processedCount, errors: errors.length > 0 ? errors : undefined };
  }
);
