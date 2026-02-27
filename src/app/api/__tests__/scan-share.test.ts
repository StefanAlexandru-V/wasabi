import { describe, it, expect, beforeEach } from "vitest";
import {
  mockPrisma,
  setAuthenticatedUser,
  resetMocks,
  TEST_IDS,
} from "@/__tests__/helpers/mocks";
import { POST, DELETE } from "@/app/api/scan/[id]/share/route";
import { NextRequest } from "next/server";

function makePostRequest(id: string) {
  return [
    new NextRequest(`http://localhost:3000/api/scan/${id}/share`, { method: "POST" }),
    { params: Promise.resolve({ id }) },
  ] as const;
}

function makeDeleteRequest(id: string) {
  return [
    new NextRequest(`http://localhost:3000/api/scan/${id}/share`, { method: "DELETE" }),
    { params: Promise.resolve({ id }) },
  ] as const;
}

describe("POST /api/scan/:id/share", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const [req, ctx] = makePostRequest(TEST_IDS.scan1);
    const res = await POST(req, ctx);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid scan ID", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    const [req, ctx] = makePostRequest("not-a-uuid");
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 404 when scan not found", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.scan.findFirst.mockResolvedValue(null);

    const [req, ctx] = makePostRequest(TEST_IDS.scan1);
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns existing share token if already set", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.scan.findFirst.mockResolvedValue({
      id: TEST_IDS.scan1,
      shareToken: "existing-token-abc",
    });

    const [req, ctx] = makePostRequest(TEST_IDS.scan1);
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.shareToken).toBe("existing-token-abc");
    expect(mockPrisma.scan.update).not.toHaveBeenCalled();
  });

  it("generates and stores a new share token", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.scan.findFirst.mockResolvedValue({
      id: TEST_IDS.scan1,
      shareToken: null,
    });
    mockPrisma.scan.update.mockResolvedValue({});

    const [req, ctx] = makePostRequest(TEST_IDS.scan1);
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.shareToken).toBeTruthy();
    expect(typeof body.shareToken).toBe("string");
    expect(mockPrisma.scan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_IDS.scan1 },
        data: { shareToken: expect.any(String) },
      })
    );
  });
});

describe("DELETE /api/scan/:id/share", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const [req, ctx] = makeDeleteRequest(TEST_IDS.scan1);
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(401);
  });

  it("returns 404 when scan not found", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.scan.findFirst.mockResolvedValue(null);

    const [req, ctx] = makeDeleteRequest(TEST_IDS.scan1);
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(404);
  });

  it("revokes share token", async () => {
    setAuthenticatedUser({ id: TEST_IDS.user1 });
    mockPrisma.scan.findFirst.mockResolvedValue({
      id: TEST_IDS.scan1,
      shareToken: "some-token",
    });
    mockPrisma.scan.update.mockResolvedValue({});

    const [req, ctx] = makeDeleteRequest(TEST_IDS.scan1);
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockPrisma.scan.update).toHaveBeenCalledWith({
      where: { id: TEST_IDS.scan1 },
      data: { shareToken: null },
    });
  });
});
