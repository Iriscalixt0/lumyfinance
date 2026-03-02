import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const mockCreateClient = vi.mocked(
  (await import("@/lib/supabase/server")).createClient
);
const mockCookies = vi.mocked((await import("next/headers")).cookies);

describe("GET /api/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({
      get: (name: string) => (name === "workspace_id" ? { value: "ws-1" } : undefined),
    } as never);
    mockCreateClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({
              data: [],
              error: null,
            }),
          }),
        }),
      }),
    } as never);
  });

  it("retorna 401 quando não autenticado", async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
      from: () => ({}),
    } as never);

    const res = await GET(new Request("http://localhost/api/export"));
    expect(res.status).toBe(401);
  });

  it("retorna 400 quando não tem workspace_id no cookie", async () => {
    mockCookies.mockResolvedValueOnce({
      get: () => undefined,
    } as never);

    const res = await GET(new Request("http://localhost/api/export"));
    expect(res.status).toBe(400);
  });

  it("retorna 200 com JSON quando format não é csv", async () => {
    const res = await GET(new Request("http://localhost/api/export"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    const body = await res.json();
    expect(body.workspace_id).toBe("ws-1");
    expect(body.transactions).toEqual([]);
    expect(body.investments).toEqual([]);
    expect(body.goals).toEqual([]);
    expect(body.goal_contributions).toEqual([]);
  });

  it("retorna CSV quando format=csv", async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            order: () =>
              Promise.resolve({
                data:
                  table === "transactions"
                    ? [{ type: "income", date: "2024-01-01", description: "Salário", amount: 500000 }]
                    : table === "investments"
                      ? [{ date: "2024-01-15", name: "CDB", amount: 10000 }]
                      : [],
                error: null,
              }),
          }),
        }),
      }),
    } as never);

    const res = await GET(new Request("http://localhost/api/export?format=csv"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    const text = await res.text();
    expect(text).toContain("Tipo,Data");
    expect(text).toContain("income,2024-01-01");
  });
});



