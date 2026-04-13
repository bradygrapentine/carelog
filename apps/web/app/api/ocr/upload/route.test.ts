import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: {
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}));
vi.mock("@/lib/supabaseServer", () => ({
  getRequestUser: vi.fn(),
}));
vi.mock("@/inngest/client", () => ({
  inngest: { send: vi.fn().mockResolvedValue(undefined) },
}));

import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getRequestUser } from "@/lib/supabaseServer";
import { POST } from "./route";

const USER_ID = "11111111-0000-0000-0000-000000000001";
const ORG_ID = "22222222-0000-0000-0000-000000000002";
const REC_ID = "33333333-0000-0000-0000-000000000003";
const JOB_ID = "44444444-0000-0000-0000-000000000004";

function makeSelectChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.not = () => chain;
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

function makeInsertChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const insertSpy = vi.fn((row: unknown) => {
    (chain as any).__lastInsert = row;
    return chain;
  });
  chain.insert = insertSpy;
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.single = vi.fn().mockResolvedValue(result);
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  (chain as any).__insertSpy = insertSpy;
  return chain;
}

function makeStorageBucket(uploadError: unknown = null) {
  return {
    upload: vi.fn().mockResolvedValue({ error: uploadError }),
    getPublicUrl: vi
      .fn()
      .mockReturnValue({ data: { publicUrl: "http://storage/img.png" } }),
  };
}

// NextRequest doesn't reliably handle FormData bodies in the Node/jsdom test environment
// (body stream hangs). Build a minimal request-like object with a mocked formData() instead.
function uploadRequest(
  orgId = ORG_ID,
  recipientId = REC_ID,
  includeFile = true,
  fileName = "rx.png",
  fileType = "image/png",
) {
  const fd = new FormData();
  fd.append("orgId", orgId);
  fd.append("recipientId", recipientId);
  if (includeFile) {
    const file = new File(["data"], fileName, { type: fileType });
    // stub arrayBuffer so the route doesn't hang on stream parsing in tests,
    // and return valid magic bytes matching the declared MIME so the R2-003
    // sniffer check passes. For unsupported types, return zeros.
    const magic = new Uint8Array(16);
    if (fileType === "image/png") {
      magic.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    } else if (fileType === "image/jpeg") {
      magic.set([0xff, 0xd8, 0xff, 0xe0]);
    } else if (fileType === "application/pdf") {
      magic.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
    } else if (fileType === "image/heic" || fileType === "image/heif") {
      magic.set([
        0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
      ]);
    }
    Object.defineProperty(file, "arrayBuffer", {
      value: () => Promise.resolve(magic.buffer),
    });
    fd.append("file", file);
  }
  // Return a minimal request-like object; getRequestUser is fully mocked so it accepts any shape
  return {
    formData: () => Promise.resolve(fd),
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
  vi.mocked(supabaseAdmin.storage.from).mockReset();
  vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);
});

describe("POST /api/ocr/upload", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null as any);
    const res = await POST(uploadRequest());
    expect(res.status).toBe(401);
  });

  it("returns 400 when file is missing", async () => {
    const res = await POST(uploadRequest(ORG_ID, REC_ID, false));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Missing file/);
  });

  it("returns 400 when orgId is not a valid UUID", async () => {
    const res = await POST(uploadRequest("not-a-uuid", REC_ID));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid/);
  });

  it("returns 403 when caller is not a coordinator", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeSelectChain({ data: { role: "caregiver" }, error: null }) as any,
    );
    const res = await POST(uploadRequest());
    expect(res.status).toBe(403);
  });

  it("returns 403 when recipient does not belong to org", async () => {
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(
        makeSelectChain({ data: { role: "coordinator" }, error: null }) as any,
      )
      .mockReturnValueOnce(makeSelectChain({ data: null, error: null }) as any);
    const res = await POST(uploadRequest());
    expect(res.status).toBe(403);
  });

  it("returns 500 when storage upload fails", async () => {
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(
        makeSelectChain({ data: { role: "coordinator" }, error: null }) as any,
      )
      .mockReturnValueOnce(
        makeSelectChain({ data: { id: REC_ID }, error: null }) as any,
      );
    vi.mocked(supabaseAdmin.storage.from).mockReturnValue(
      makeStorageBucket({ message: "bucket full" }) as any,
    );
    const res = await POST(uploadRequest());
    expect(res.status).toBe(500);
  });

  it("returns 200 with jobId on success", async () => {
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(
        makeSelectChain({ data: { role: "coordinator" }, error: null }) as any,
      )
      .mockReturnValueOnce(
        makeSelectChain({ data: { id: REC_ID }, error: null }) as any,
      )
      .mockReturnValueOnce(
        makeInsertChain({ data: { id: JOB_ID }, error: null }) as any,
      );
    vi.mocked(supabaseAdmin.storage.from).mockReturnValue(
      makeStorageBucket() as any,
    );

    const res = await POST(uploadRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobId).toBe(JOB_ID);
  });

  // F-002 regression: ensure prescription-image URLs are NOT made public
  it("does not call getPublicUrl and stores the storage path (not a public URL)", async () => {
    const insertChain = makeInsertChain({
      data: { id: JOB_ID },
      error: null,
    });
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(
        makeSelectChain({ data: { role: "coordinator" }, error: null }) as any,
      )
      .mockReturnValueOnce(
        makeSelectChain({ data: { id: REC_ID }, error: null }) as any,
      )
      .mockReturnValueOnce(insertChain as any);
    const bucket = makeStorageBucket();
    vi.mocked(supabaseAdmin.storage.from).mockReturnValue(bucket as any);

    const res = await POST(uploadRequest());
    expect(res.status).toBe(200);
    expect(bucket.getPublicUrl).not.toHaveBeenCalled();
    const inserted = (insertChain as any).__lastInsert as { image_url: string };
    expect(inserted.image_url).toMatch(
      new RegExp("^" + ORG_ID + "/" + REC_ID + "/"),
    );
    expect(inserted.image_url).not.toMatch(/^https?:\/\//);
  });

  // F-012 regression: malicious filenames must not influence the storage path.
  it("ignores user-supplied filename — no path traversal in storage path", async () => {
    const insertChain = makeInsertChain({
      data: { id: JOB_ID },
      error: null,
    });
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(
        makeSelectChain({ data: { role: "coordinator" }, error: null }) as any,
      )
      .mockReturnValueOnce(
        makeSelectChain({ data: { id: REC_ID }, error: null }) as any,
      )
      .mockReturnValueOnce(insertChain as any);
    const bucket = makeStorageBucket();
    vi.mocked(supabaseAdmin.storage.from).mockReturnValue(bucket as any);

    const malicious = "../../other-org/evil.png";
    const res = await POST(
      uploadRequest(ORG_ID, REC_ID, true, malicious, "image/png"),
    );
    expect(res.status).toBe(200);
    const inserted = (insertChain as any).__lastInsert as { image_url: string };
    expect(inserted.image_url).not.toContain("..");
    expect(inserted.image_url).not.toContain("other-org");
    expect(inserted.image_url).not.toContain("evil");
    // Path must remain rooted under the validated org/recipient prefix.
    expect(inserted.image_url.startsWith(ORG_ID + "/" + REC_ID + "/")).toBe(
      true,
    );
  });

  // R2-003 regression: declared MIME must match actual file bytes (magic sniff).
  it("rejects bytes that don't match the declared MIME (e.g. HTML posing as PNG)", async () => {
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(
        makeSelectChain({ data: { role: "coordinator" }, error: null }) as any,
      )
      .mockReturnValueOnce(
        makeSelectChain({ data: { id: REC_ID }, error: null }) as any,
      );
    vi.mocked(supabaseAdmin.storage.from).mockReturnValue(
      makeStorageBucket() as any,
    );

    // Build a request with fileType=image/png but bytes that are HTML
    const fd = new FormData();
    fd.append("orgId", ORG_ID);
    fd.append("recipientId", REC_ID);
    const file = new File(["<html></html>"], "rx.png", { type: "image/png" });
    const htmlBytes = new TextEncoder().encode("<html><body>xss</body></html>");
    Object.defineProperty(file, "arrayBuffer", {
      value: () => Promise.resolve(htmlBytes.buffer),
    });
    fd.append("file", file);
    const req = {
      formData: () => Promise.resolve(fd),
    } as unknown as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/does not match declared type/);
  });

  // F-012: disallowed MIME types must be rejected (no extension fallback).
  it("rejects unsupported MIME types", async () => {
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(
        makeSelectChain({ data: { role: "coordinator" }, error: null }) as any,
      )
      .mockReturnValueOnce(
        makeSelectChain({ data: { id: REC_ID }, error: null }) as any,
      );
    vi.mocked(supabaseAdmin.storage.from).mockReturnValue(
      makeStorageBucket() as any,
    );
    const res = await POST(
      uploadRequest(ORG_ID, REC_ID, true, "rx.exe", "application/x-msdownload"),
    );
    expect(res.status).toBe(400);
  });
});
