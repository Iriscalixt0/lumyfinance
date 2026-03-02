import { describe, it, expect, vi, beforeEach } from "vitest";
import { getWorkspacesForUser, getWorkspaceById, leaveWorkspace } from "./workspaces";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  getCachedUser: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  };
});

const serverModule = await import("@/lib/supabase/server");
const mockCreateClient = vi.mocked(serverModule.createClient);
const mockGetCachedUser = vi.mocked(serverModule.getCachedUser);

describe("workspaces actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getWorkspacesForUser", () => {
    it("retorna [] quando usuário não está logado", async () => {
      mockGetCachedUser.mockResolvedValue(null);
      mockCreateClient.mockResolvedValue({
        from: () => ({}),
      } as never);

      const result = await getWorkspacesForUser();
      expect(result).toEqual([]);
    });

    it("retorna [] quando usuário não tem membros", async () => {
      mockGetCachedUser.mockResolvedValue({ id: "u1" } as never);
      mockCreateClient.mockResolvedValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              not: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      } as never);

      const result = await getWorkspacesForUser();
      expect(result).toEqual([]);
    });

    it("retorna workspaces quando usuário é membro", async () => {
      const workspaces = [
        { id: "ws-1", name: "Pessoal", slug: "pessoal", plan: "pro" },
      ];
      mockGetCachedUser.mockResolvedValue({ id: "u1" } as never);
      mockCreateClient.mockResolvedValue({
        from: (table: string) => {
          if (table === "workspace_members") {
            return {
              select: () => ({
                eq: () => ({
                  not: () => Promise.resolve({
                    data: [{ workspace_id: "ws-1" }],
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {
            select: () => ({
              in: () => ({
                order: () => Promise.resolve({ data: workspaces, error: null }),
              }),
            }),
          };
        },
      } as never);

      const result = await getWorkspacesForUser();
      expect(result).toEqual(workspaces);
    });
  });

  describe("getWorkspaceById", () => {
    it("retorna null quando workspaceId é null", async () => {
      const result = await getWorkspaceById(null);
      expect(result).toBeNull();
    });

    it("retorna null quando usuário não logado", async () => {
      mockGetCachedUser.mockResolvedValue(null);
      mockCreateClient.mockResolvedValue({
        from: () => ({}),
      } as never);

      const result = await getWorkspaceById("ws-1");
      expect(result).toBeNull();
    });

    it("retorna workspace quando encontrado", async () => {
      const workspace = { id: "ws-1", name: "Meu", slug: "meu", plan: "pro" };
      mockGetCachedUser.mockResolvedValue({ id: "u1" } as never);
      mockCreateClient.mockResolvedValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: workspace, error: null }),
            }),
          }),
        }),
      } as never);

      const result = await getWorkspaceById("ws-1");
      expect(result).toEqual(workspace);
    });
  });

  describe("leaveWorkspace", () => {
    const workspaceId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it("bloqueia saida do dono", async () => {
      mockCreateClient.mockResolvedValue({
        auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
        from: (table: string) => {
          if (table === "workspace_members") {
            return {
              select: (columns: string) => {
                if (columns === "id, role") {
                  return {
                    eq: () => ({
                      eq: () => ({
                        not: () => ({
                          maybeSingle: () => Promise.resolve({ data: { id: "m1", role: "owner" }, error: null }),
                        }),
                      }),
                    }),
                  };
                }
                return {
                  eq: () => ({
                    not: () => Promise.resolve({ data: [{ workspace_id: workspaceId }], error: null }),
                  }),
                };
              },
              delete: () => ({
                eq: () => ({
                  eq: () => ({
                    select: () => Promise.resolve({ data: [{ id: "m1" }], error: null }),
                  }),
                }),
              }),
            };
          }

          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: { owner_id: "u1" }, error: null }),
              }),
            }),
          };
        },
      } as never);

      const result = await leaveWorkspace(workspaceId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("dono");
      }
    });

    it("permite sair quando nao e dono e retorna proximo workspace", async () => {
      mockCreateClient.mockResolvedValue({
        auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
        from: (table: string) => {
          if (table === "workspace_members") {
            return {
              select: (columns: string) => {
                if (columns === "id, role") {
                  return {
                    eq: () => ({
                      eq: () => ({
                        not: () => ({
                          maybeSingle: () => Promise.resolve({ data: { id: "m1", role: "viewer" }, error: null }),
                        }),
                      }),
                    }),
                  };
                }
                return {
                  eq: () => ({
                    not: () =>
                      Promise.resolve({
                        data: [{ workspace_id: workspaceId }, { workspace_id: "9e7f3ab8-5e17-4a34-8ab4-71f6f7640b99" }],
                        error: null,
                      }),
                  }),
                };
              },
              delete: () => ({
                eq: () => ({
                  eq: () => ({
                    select: () => Promise.resolve({ data: [{ id: "m1" }], error: null }),
                  }),
                }),
              }),
            };
          }

          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: { owner_id: "u2" }, error: null }),
              }),
            }),
          };
        },
      } as never);

      const result = await leaveWorkspace(workspaceId);
      expect(result).toEqual({ ok: true, nextWorkspaceId: "9e7f3ab8-5e17-4a34-8ab4-71f6f7640b99" });
    });

    it("retorna erro quando nenhuma linha e removida e nao ha admin client", async () => {
      const prevServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const prevSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      try {
        mockCreateClient.mockResolvedValue({
          auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
          from: (table: string) => {
            if (table === "workspace_members") {
              return {
                select: (columns: string) => {
                  if (columns === "id, role") {
                    return {
                      eq: () => ({
                        eq: () => ({
                          not: () => ({
                            maybeSingle: () => Promise.resolve({ data: { id: "m1", role: "viewer" }, error: null }),
                          }),
                        }),
                      }),
                    };
                  }
                  return {
                    eq: () => ({
                      not: () =>
                        Promise.resolve({
                          data: [{ workspace_id: workspaceId }],
                          error: null,
                        }),
                    }),
                  };
                },
                delete: () => ({
                  eq: () => ({
                    eq: () => ({
                      select: () => Promise.resolve({ data: [], error: null }),
                    }),
                  }),
                }),
              };
            }

            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: { owner_id: "u2" }, error: null }),
                }),
              }),
            };
          },
        } as never);

        const result = await leaveWorkspace(workspaceId);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toContain("Nao foi possivel sair do workspace");
        }
      } finally {
        if (typeof prevServiceKey === "string") {
          process.env["SUPABASE_SERVICE_ROLE_KEY"] = prevServiceKey;
        } else {
          delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        }
        if (typeof prevSupabaseUrl === "string") {
          process.env.NEXT_PUBLIC_SUPABASE_URL = prevSupabaseUrl;
        } else {
          delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        }
      }
    });
  });
});

