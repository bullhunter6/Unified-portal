import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadPagesRoute(userId = 7) {
  vi.resetModules();
  const findFirst = vi.fn().mockResolvedValue(null);

  vi.doMock("server-only", () => ({}));
  vi.doMock("@/lib/pdfx/auth", () => ({
    requirePdfxUser: vi.fn().mockResolvedValue({
      userId,
      session: { user: { id: String(userId) } },
    }),
  }));
  vi.doMock("@esgcredit/db-esg", () => ({
    esgPrisma: { pdf_translation_jobs: { findFirst } },
  }));

  const route = await import("@/app/api/pdfx/pages/route");
  return { findFirst, route };
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("PDFX route security", () => {
  it("checks durable ownership before returning page text", async () => {
    const { findFirst, route } = await loadPagesRoute(7);
    const jobId = "e05fb166-61fd-4b8f-a7dc-4352d8cbf309";

    const response = await route.GET(
      new Request(`http://localhost/api/pdfx/pages?jobId=${jobId}`),
    );

    expect(response.status).toBe(404);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: jobId, user_id: 7 },
    });
  });

  it("scopes persisted page text by both job and authenticated owner", async () => {
    const { findFirst, route } = await loadPagesRoute(7);
    const jobId = "e05fb166-61fd-4b8f-a7dc-4352d8cbf309";

    const response = await route.GET(
      new Request(`http://localhost/api/pdfx/pages?jobId=${jobId}`),
    );

    expect(response.status).toBe(404);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: jobId, user_id: 7 },
    });
  });

  it("stores valid input in the durable queue under a UUID, never a client path", async () => {
    vi.resetModules();
    const startPdfJob = vi.fn().mockResolvedValue(undefined);

    vi.doMock("server-only", () => ({}));
    vi.doMock("@/lib/pdfx/auth", () => ({
      requirePdfxUser: vi.fn().mockResolvedValue({
        userId: 7,
        session: { user: { id: "7" } },
      }),
    }));
    vi.doMock("@/lib/api-usage", () => ({
      enforceApiUsage: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("@/lib/pdfx/pipeline", () => ({ startPdfJob }));

    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = Uint8Array.from(await pdf.save());
    const form = new FormData();
    form.set(
      "file",
      new File([bytes], "../../../outside.pdf", { type: "application/pdf" }),
    );
    form.set("targetLang", "English");

    const { POST } = await import("@/app/api/pdfx/upload/route");
    const response = await POST(
      new Request("http://localhost/api/pdfx/upload", { method: "POST", body: form }),
    );
    const body = (await response.json()) as { jobId: string };

    expect(response.status).toBe(200);
    expect(body.jobId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(startPdfJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: body.jobId,
        userId: 7,
        filename: "outside.pdf",
        storedFilename: `${body.jobId}.pdf`,
        pageCount: 1,
        inputBuffer: expect.any(Buffer),
      }),
    );
  });

  it("rejects an oversized streamed multipart body without trusting Content-Length", async () => {
    vi.resetModules();
    const startPdfJob = vi.fn();

    vi.doMock("server-only", () => ({}));
    vi.doMock("@/lib/pdfx/auth", () => ({
      requirePdfxUser: vi.fn().mockResolvedValue({
        userId: 7,
        session: { user: { id: "7" } },
      }),
    }));
    vi.doMock("@/lib/api-usage", () => ({
      enforceApiUsage: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("@/lib/pdfx/pipeline", () => ({ startPdfJob }));

    const chunk = new Uint8Array(1024 * 1024);
    let chunksSent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (chunksSent >= 22) {
          controller.close();
          return;
        }
        chunksSent += 1;
        controller.enqueue(chunk);
      },
    });
    const request = new Request("http://localhost/api/pdfx/upload", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=pdfx-test" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const { POST } = await import("@/app/api/pdfx/upload/route");
    const response = await POST(request);

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "PDF exceeds the 20 MB limit" });
    expect(startPdfJob).not.toHaveBeenCalled();
  });
});
