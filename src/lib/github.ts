import { graphql } from "@octokit/graphql";
import { Octokit } from "@octokit/rest";

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  reset: number;
}

let lastRateLimit: RateLimitInfo | null = null;

export function getLastRateLimit(): RateLimitInfo | null {
  return lastRateLimit;
}

export function createGraphQLClient(token: string) {
  return graphql.defaults({
    headers: {
      authorization: `token ${token}`,
    },
  });
}

export function createRestClient(token: string) {
  return new Octokit({ auth: token });
}

function extractRateLimit(headers: Record<string, string | undefined>): void {
  const remaining = headers["x-ratelimit-remaining"];
  const limit = headers["x-ratelimit-limit"];
  const reset = headers["x-ratelimit-reset"];
  if (remaining && limit && reset) {
    lastRateLimit = {
      remaining: parseInt(remaining, 10),
      limit: parseInt(limit, 10),
      reset: parseInt(reset, 10),
    };
  }
}

interface VulnerabilityAlertNode {
  securityVulnerability: {
    severity: string;
  } | null;
}

interface OrgRepo {
  name: string;
  id: string;
  defaultBranchRef: { name: string } | null;
  isArchived: boolean;
  pushedAt: string | null;
  vulnerabilityAlerts: { nodes: VulnerabilityAlertNode[] };
}

interface OrgReposResponse {
  organization: {
    repositories: {
      nodes: OrgRepo[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
}

export async function fetchOrgRepos(
  token: string,
  orgName: string,
  maxRepos?: number
): Promise<OrgRepo[]> {
  const gql = createGraphQLClient(token);
  const repos: OrgRepo[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const batchSize = maxRepos
      ? Math.min(20, maxRepos - repos.length)
      : 20;

    if (batchSize <= 0) break;

    const response: OrgReposResponse = await gql(
      `
      query($org: String!, $first: Int!, $after: String) {
        organization(login: $org) {
          repositories(first: $first, after: $after, orderBy: {field: PUSHED_AT, direction: DESC}) {
            nodes {
              name
              id
              defaultBranchRef { name }
              isArchived
              pushedAt
              vulnerabilityAlerts(first: 100, states: OPEN) {
                nodes { securityVulnerability { severity } }
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
      `,
      { org: orgName, first: batchSize, after: cursor }
    );

    repos.push(...response.organization.repositories.nodes);
    hasNextPage = response.organization.repositories.pageInfo.hasNextPage;
    cursor = response.organization.repositories.pageInfo.endCursor;

    if (maxRepos && repos.length >= maxRepos) break;
  }

  return maxRepos ? repos.slice(0, maxRepos) : repos;
}

export async function checkBranchProtection(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<boolean> {
  const octokit = createRestClient(token);
  try {
    const res = await octokit.repos.getBranchProtection({ owner, repo, branch });
    extractRateLimit(res.headers as Record<string, string | undefined>);
    return true;
  } catch {
    return false;
  }
}

export async function checkFileExists(
  token: string,
  owner: string,
  repo: string,
  path: string
): Promise<boolean> {
  const octokit = createRestClient(token);
  try {
    const res = await octokit.repos.getContent({ owner, repo, path });
    extractRateLimit(res.headers as Record<string, string | undefined>);
    return true;
  } catch {
    return false;
  }
}

export async function countStalePRs(
  token: string,
  owner: string,
  repo: string
): Promise<number> {
  const octokit = createRestClient(token);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    const { data: prs, headers } = await octokit.pulls.list({
      owner,
      repo,
      state: "open",
      sort: "created",
      direction: "asc",
      per_page: 100,
    });
    extractRateLimit(headers as Record<string, string | undefined>);

    return prs.filter(
      (pr) => new Date(pr.created_at) < thirtyDaysAgo
    ).length;
  } catch {
    return 0;
  }
}

export async function fetchUserOrgs(token: string) {
  const octokit = createRestClient(token);
  const { data, headers } = await octokit.orgs.listForAuthenticatedUser();
  extractRateLimit(headers as Record<string, string | undefined>);
  return data.map((org) => ({
    id: String(org.id),
    login: org.login,
    avatar_url: org.avatar_url,
  }));
}

export async function fetchRateLimit(token: string): Promise<RateLimitInfo> {
  const octokit = createRestClient(token);
  const { data } = await octokit.rateLimit.get();
  const core = data.resources.core;
  lastRateLimit = {
    remaining: core.remaining,
    limit: core.limit,
    reset: core.reset,
  };
  return lastRateLimit;
}
