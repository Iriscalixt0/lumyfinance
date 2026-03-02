import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createTransaction,
  deleteTransaction,
  getMonthlyTransactions,
} from "./transactions";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
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

describe("transactions actions", () => {
  const validPayload = {
    workspace_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    category_id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    type: "income" as const,
    amount: 100.5,
    description: "Salário",
    date: "2024-03-15",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
      from: () => ({
        insert: () => Promise.resolve({ error: null }),
        delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
    } as never);
  });

  describe("createTransaction", () => {
    it("rejeita quando usuário não está autenticado", async () => {
      mockCreateClient.mockResolvedValueOnce({
        auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
        from: () => ({}),
      } as never);

      await expect(createTransaction(validPayload)).rejects.toThrow("Não autorizado");
    });

    it("converte amount em reais para centavos", async () => {
      let inserted: unknown = null;
      mockCreateClient.mockResolvedValueOnce({
        auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
        from: (table: string) => {
          if (table === "workspaces") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: {
                        id: validPayload.workspace_id,
                        stripe_subscription_id: "sub_123",
                        beta_program_id: null,
                      },
                      error: null,
                    }),
                }),
              }),
            };
          }

          return {
            insert: (data: unknown) => {
              inserted = data;
              return {
                select: () => ({
                  single: () => Promise.resolve({ data: null, error: null }),
                }),
              };
            },
          };
        },
      } as never);

      await createTransaction({ ...validPayload, amount: 150.5 });
      expect(inserted).toBeDefined();
      expect((inserted as { amount: number }).amount).toBe(15050);
    });

    it("valida date no formato YYYY-MM-DD", async () => {
      await expect(
        createTransaction({ ...validPayload, date: "15/03/2024" })
      ).rejects.toThrow();
    });

    it("valida type como income ou expense", async () => {
      await expect(
        createTransaction({ ...validPayload, type: "invalid" as "income" })
      ).rejects.toThrow();
    });
  });

  describe("deleteTransaction", () => {
    it("chama delete com id e workspace_id", async () => {
      const from = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      });
      mockCreateClient.mockResolvedValueOnce({
        auth: { getUser: () => Promise.resolve({ data: { user: {} } }) },
        from,
      } as never);

      await deleteTransaction("tx-1", "ws-1");
      expect(from).toHaveBeenCalledWith("transactions");
    });
  });

  describe("getMonthlyTransactions", () => {
    it("retorna array vazio quando não há dados", async () => {
      const result = await getMonthlyTransactions("ws-1", 2024, 2);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it("usa intervalo de datas do mês correto", async () => {
      let gteVal = "";
      let lteVal = "";
      mockCreateClient.mockResolvedValueOnce({
        auth: { getUser: () => Promise.resolve({ data: { user: {} } }) },
        from: () => ({
          select: () => ({
            eq: () => ({
              gte: (k: string, v: string) => {
                gteVal = v;
                return {
                  lte: (k2: string, v2: string) => {
                    lteVal = v2;
                    return { order: () => Promise.resolve({ data: [], error: null }) };
                  },
                };
              },
            }),
          }),
        }),
      } as never);

      await getMonthlyTransactions("ws-1", 2024, 0);
      expect(gteVal).toBe("2024-01-01");
      expect(lteVal).toBe("2024-01-31");
    });
  });
});



