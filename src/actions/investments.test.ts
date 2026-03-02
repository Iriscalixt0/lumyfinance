import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createInvestment,
  deleteInvestment,
  getMonthlyInvestments,
} from "./investments";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockCreateClient = vi.mocked(
  (await import("@/lib/supabase/server")).createClient
);

describe("investments actions", () => {
  const validPayload = {
    workspace_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    name: "CDB",
    amount: 1000,
    date: "2024-06-01",
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

  describe("createInvestment", () => {
    it("rejeita quando usuário não autenticado", async () => {
      mockCreateClient.mockResolvedValueOnce({
        auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
        from: () => ({}),
      } as never);

      await expect(createInvestment(validPayload)).rejects.toThrow("Não autorizado");
    });

    it("converte amount para centavos", async () => {
      let inserted: unknown = null;
      mockCreateClient.mockResolvedValueOnce({
        auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
        from: () => ({
          insert: (data: unknown) => {
            inserted = data;
            return Promise.resolve({ error: null });
          },
        }),
      } as never);

      await createInvestment({ ...validPayload, amount: 250.75 });
      expect((inserted as { amount: number }).amount).toBe(25075);
    });

    it("usa type 'outro' quando não informado", async () => {
      let inserted: unknown = null;
      mockCreateClient.mockResolvedValueOnce({
        auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
        from: () => ({
          insert: (data: unknown) => {
            inserted = data;
            return Promise.resolve({ error: null });
          },
        }),
      } as never);

      await createInvestment(validPayload);
      expect((inserted as { type: string }).type).toBe("outro");
    });
  });

  describe("deleteInvestment", () => {
    it("não lança quando delete retorna sucesso", async () => {
      await expect(
        deleteInvestment("inv-1", "ws-1")
      ).resolves.toBeUndefined();
    });
  });

  describe("getMonthlyInvestments", () => {
    it("retorna lista vazia quando sem dados", async () => {
      const result = await getMonthlyInvestments("ws-1", 2024, 5);
      expect(result).toEqual([]);
    });
  });
});



