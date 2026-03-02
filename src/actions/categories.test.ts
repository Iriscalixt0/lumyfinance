import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCategoriesForWorkspace } from "./categories";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  };
});

const mockCreateClient = vi.mocked(
  (await import("@/lib/supabase/server")).createClient
);

describe("categories actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna array de categorias do workspace", async () => {
    const fakeCategories = [
      { id: "c1", name: "Salário", type: "income", workspace_id: "ws-1" },
      { id: "c2", name: "Supermercado", type: "expense", workspace_id: "ws-1" },
    ];
    mockCreateClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              order: () => Promise.resolve({ data: fakeCategories, error: null }),
            }),
          }),
        }),
      }),
    } as never);

    const result = await getCategoriesForWorkspace("ws-1");
    expect(result).toEqual(fakeCategories);
  });

  it("retorna array vazio quando data é null", async () => {
    mockCreateClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              order: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      }),
    } as never);

    const result = await getCategoriesForWorkspace("ws-1");
    expect(result).toEqual([]);
  });

  it("lança quando Supabase retorna error", async () => {
    mockCreateClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              order: () => Promise.resolve({ data: null, error: { message: "DB error" } }),
            }),
          }),
        }),
      }),
    } as never);

    await expect(getCategoriesForWorkspace("ws-1")).rejects.toThrow("DB error");
  });
});



