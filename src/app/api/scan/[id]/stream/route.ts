import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, validateUUID } from "@/lib/api-utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { id: rawId } = await params;
    const id = validateUUID(rawId);
    if (!id) {
      return new Response("Invalid scan ID", { status: 400 });
    }

    const scan = await prisma.scan.findFirst({
      where: { id, org: { ownerUserId: user.id } },
      select: { id: true, status: true },
    });

    if (!scan) {
      return new Response("Scan not found", { status: 404 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;

        function closeStream() {
          if (!closed) {
            closed = true;
            try {
              controller.close();
            } catch {
              // Controller may already be closed
            }
          }
        }

        function send(data: Record<string, unknown>) {
          if (!closed) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          }
        }

        let lastStatus = "";
        let lastProcessed = -1;

        const poll = async () => {
          if (closed) return false;

          try {
            const current = await prisma.scan.findUnique({
              where: { id },
              select: {
                status: true,
                startedAt: true,
                totalRepoCount: true,
                processedRepoCount: true,
                repoCount: true,
                completedAt: true,
              },
            });

            if (!current) {
              send({ type: "error", message: "Scan not found" });
              closeStream();
              return false;
            }

            if (current.status !== lastStatus || current.processedRepoCount !== lastProcessed) {
              lastStatus = current.status;
              lastProcessed = current.processedRepoCount;
              send({
                type: "progress",
                status: current.status,
                startedAt: current.startedAt,
                totalRepoCount: current.totalRepoCount,
                processedRepoCount: current.processedRepoCount,
                repoCount: current.repoCount,
                completedAt: current.completedAt,
              });
            }

            if (current.status === "completed" || current.status === "failed" || current.status === "cancelled") {
              send({ type: "done", status: current.status, repoCount: current.repoCount });
              closeStream();
              return false;
            }

            return true;
          } catch {
            closeStream();
            return false;
          }
        };

        let shouldContinue = await poll();
        if (!shouldContinue) return;

        const interval = setInterval(async () => {
          shouldContinue = await poll();
          if (!shouldContinue) clearInterval(interval);
        }, 2000);

        setTimeout(() => {
          clearInterval(interval);
          send({ type: "timeout" });
          closeStream();
        }, 300_000);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return new Response("Internal server error", { status: 500 });
  }
}
