import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createGoal,
  deleteGoal,
  createGoalContribution,
  getGoals,
  getMonthlyGoalContributions,
} from "./goals";

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

describe("goals actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
      from: () => ({
        insert: () => Promise.resolve({ error: null }),
        delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
            order: () => Promise.resolve({ data: [], error: null }),
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

  describe("createGoal", () => {
    it("rejeita sem usuário", async () => {
      mockCreateClient.mockResolvedValueOnce({
        auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
        from: () => ({}),
      } as never);

      await expect(
        createGoal({
          workspace_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          title: "Carro",
          target_amount: 50000,
        })
      ).rejects.toThrow(/autorizado/i);
    });

    it("converte target_amount para centavos", async () => {
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

      await createGoal({
        workspace_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        title: "Viagem",
        target_amount: 3000.5,
      });
      expect((inserted as { target_amount: number }).target_amount).toBe(300050);
    });
  });

  describe("deleteGoal", () => {
    it("não lança quando delete ok", async () => {
      await expect(deleteGoal("g-1", "ws-1")).resolves.toBeUndefined();
    });
  });

  describe("createGoalContribution", () => {
    it("rejeita sem usuário", async () => {
      mockCreateClient.mockResolvedValueOnce({
        auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
        from: () => ({}),
      } as never);

      await expect(
        createGoalContribution({
          workspace_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          goal_id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          amount: 100,
          date: "2024-04-01",
        })
      ).rejects.toThrow(/autorizado/i);
    });
  });

  describe("getGoals", () => {
    it("retorna array", async () => {
      const result = await getGoals("ws-1");
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getMonthlyGoalContributions", () => {
    it("retorna array", async () => {
      const result = await getMonthlyGoalContributions("ws-1", 2024, 2);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});




