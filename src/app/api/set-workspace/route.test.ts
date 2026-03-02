import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const mockCreateClient = vi.mocked((await import("@/lib/supabase/server")).createClient);
const mockCookies = vi.mocked((await import("next/headers")).cookies);

function buildSupabaseMock({ userId = "u1", hasMembership = true }: { userId?: string | null; hasMembership?: boolean }) {
  return {
    auth: {
      getUser: () => Promise.resolve({ data: { user: userId ? { id: userId } : null } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            not: () => ({
              single: () => Promise.resolve({ data: hasMembership ? { id: "m1" } : null, error: null }),
            }),
          }),
        }),
      }),
    }),
  };
}

describe("POST /api/set-workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(buildSupabaseMock({}) as never);
    mockCookies.mockResolvedValue({ set: vi.fn() } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValueOnce(buildSupabaseMock({ userId: null }) as never);

    const res = await POST(
      new Request("http://localhost/api/set-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: "ws-1" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when workspace_id is missing", async () => {
    const res = await POST(
      new Request("http://localhost/api/set-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 when user is not member of workspace", async () => {
    mockCreateClient.mockResolvedValueOnce(buildSupabaseMock({ hasMembership: false }) as never);

    const res = await POST(
      new Request("http://localhost/api/set-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: "ws-403" }),
      })
    );

    expect(res.status).toBe(403);
  });

  it("returns 200 and sets cookie when valid", async () => {
    const set = vi.fn();
    mockCookies.mockResolvedValueOnce({ set } as never);

    const res = await POST(
      new Request("http://localhost/api/set-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: "ws-123" }),
      })
    );

    expect(res.status).toBe(200);
    expect(set).toHaveBeenCalledWith(
      "workspace_id",
      "ws-123",
      expect.objectContaining({ path: "/" })
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
