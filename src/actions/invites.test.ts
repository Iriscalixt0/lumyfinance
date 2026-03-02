import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createWorkspaceInviteLink,
  acceptWorkspaceInvite,
  cancelWorkspaceInvite,
  removeWorkspaceMember,
  getWorkspaceInvites,
  getWorkspaceMembersWithProfiles,
} from "./invites";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  };
});
vi.mock("next/headers", () => ({ headers: vi.fn(() => Promise.resolve({ get: () => null })) }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn().mockReturnValue({
    from: () => ({
      insert: () => Promise.resolve({ error: null }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
    auth: {
      admin: {
        getUserById: () =>
          Promise.resolve({
            data: { user: { email: "member@test.com" } },
            error: null,
          }),
      },
    },
  }),
}));
const mockCreateClient = vi.mocked((await import("@/lib/supabase/server")).createClient);
const mockCreateAdminClient = vi.mocked((await import("@supabase/supabase-js")).createClient);

function baseFrom(table: string) {
  if (table === "workspaces") {
    return {
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { id: "ws-1", name: "Workspace" }, error: null }),
        }),
      }),
    };
  }

  if (table === "workspace_members") {
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({
            not: () => ({
              single: () => Promise.resolve({ data: { role: "owner" }, error: null }),
            }),
            single: () => Promise.resolve({ data: { role: "editor" }, error: null }),
          }),
          not: () => Promise.resolve({ data: [{ user_id: "u2" }], error: null }),
        }),
      }),
      delete: () => ({
        eq: () => ({
          eq: () => ({
            select: () => Promise.resolve({ data: [{ id: "wm-1" }], error: null }),
          }),
        }),
      }),
    };
  }

  if (table === "workspace_invites") {
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
        order: () => Promise.resolve({ data: [], error: null }),
      }),
      insert: () => Promise.resolve({ error: null }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    };
  }

  if (table === "profiles") {
    return {
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { full_name: "Owner" }, error: null }),
        }),
      }),
    };
  }

  return {
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: null, error: null }),
      }),
    }),
  };
}

function adminFrom(table: string) {
  if (table === "workspace_invites") {
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
        limit: () => Promise.resolve({ data: [], error: null }),
      }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    };
  }
  if (table === "workspace_members") {
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
            not: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      }),
      insert: () => Promise.resolve({ error: null }),
    };
  }
  if (table === "workspaces") {
    return {
      select: () => ({
        eq: () => ({
          not: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    };
  }
  return {
    insert: () => Promise.resolve({ error: null }),
    delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
  };
}

describe("invites actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAdminClient.mockReturnValue({
      from: adminFrom,
      auth: {
        admin: {
          getUserById: () =>
            Promise.resolve({
              data: { user: { email: "member@test.com" } },
              error: null,
            }),
        },
      },
    } as never);
  });

  it("createWorkspaceInviteLink retorna erro sem usuario", async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
      from: () => ({}),
    } as never);

    const result = await createWorkspaceInviteLink("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "Convidado", "editor");
    expect(result.ok).toBe(false);
  });

  it("createWorkspaceInviteLink valida guestName vazio", async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
      from: baseFrom,
    } as never);

    const result = await createWorkspaceInviteLink("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "", "editor");
    expect(result.ok).toBe(false);
  });

  it("acceptWorkspaceInvite retorna erro com token invalido", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "your_service_role_key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

    mockCreateClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u2", email: "invited@test.com" } } }) },
      rpc: () => Promise.resolve({ data: [], error: null }),
    } as never);

    const result = await acceptWorkspaceInvite("bad-token");
    expect(result.ok).toBe(false);
  });

  it("acceptWorkspaceInvite retorna sucesso quando usuario ja e membro via link", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "your_service_role_key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

    let inviteDeleted = false;

    mockCreateClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u2", email: "member@test.com" } } }) },
      rpc: () =>
        Promise.resolve({
          data: [
            {
              id: "inv-1",
              workspace_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
              email: "link::guest::abc123",
              role: "editor",
              invited_by: "u1",
            },
          ],
          error: null,
        }),
      from: (table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { onboarding_completed_at: null }, error: null }),
              }),
            }),
          };
        }
        return baseFrom(table);
      },
    } as never);

    mockCreateAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === "workspace_members") {
          return {
            select: (cols: string, opts?: { count?: string; head?: boolean }) => {
              if (opts?.count === "exact") {
                return {
                  eq: () => ({
                    not: () => Promise.resolve({ count: 1, data: null, error: null }),
                  }),
                };
              }
              return {
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: { id: "wm-1", accepted_at: "2026-01-01T00:00:00Z" }, error: null }),
                    not: () => ({
                      maybeSingle: () => Promise.resolve({ data: { id: "wm-1" }, error: null }),
                    }),
                  }),
                  not: () => Promise.resolve({ data: [], error: null }),
                }),
              };
            },
            insert: () => Promise.resolve({ error: null }),
          };
        }
        if (table === "workspace_invites") {
          return {
            delete: () => ({
              eq: () => {
                inviteDeleted = true;
                return Promise.resolve({ error: null });
              },
            }),
          };
        }
        if (table === "workspaces") {
          return {
            select: () => ({
              eq: () => ({
                not: () => ({
                  limit: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "profiles") {
          return {
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          };
        }
        return {
          insert: () => Promise.resolve({ error: null }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      },
      auth: {
        admin: {
          getUserById: () =>
            Promise.resolve({
              data: { user: { email: "member@test.com" } },
              error: null,
            }),
        },
      },
    } as never);

    const result = await acceptWorkspaceInvite("valid-token");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.workspaceId).toBe("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    }
    expect(inviteDeleted).toBe(false);
  });

  it("acceptWorkspaceInvite mantem link compartilhavel ativo apos aceite", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "your_service_role_key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

    let inviteDeleted = false;
    let insertCalled = false;

    mockCreateClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u3", email: "new@test.com" } } }) },
      rpc: () =>
        Promise.resolve({
          data: [
            {
              id: "inv-2",
              workspace_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
              email: "link::guest::abc123",
              role: "editor",
              invited_by: "u1",
            },
          ],
          error: null,
        }),
      from: (table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { onboarding_completed_at: "2026-01-01T00:00:00Z" }, error: null }),
              }),
            }),
          };
        }
        return baseFrom(table);
      },
    } as never);

    mockCreateAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === "workspace_members") {
          return {
            select: (cols: string, opts?: { count?: string; head?: boolean }) => {
              if (opts?.count === "exact") {
                return {
                  eq: () => ({
                    not: () => Promise.resolve({ count: 0, data: null, error: null }),
                  }),
                };
              }
              return {
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: null, error: null }),
                    not: () => ({
                      maybeSingle: () => Promise.resolve({ data: null, error: null }),
                    }),
                  }),
                  not: () => Promise.resolve({ data: [], error: null }),
                }),
              };
            },
            insert: () => {
              insertCalled = true;
              return Promise.resolve({ error: null });
            },
          };
        }
        if (table === "workspace_invites") {
          return {
            delete: () => ({
              eq: () => {
                inviteDeleted = true;
                return Promise.resolve({ error: null });
              },
            }),
          };
        }
        if (table === "workspaces") {
          return {
            select: () => ({
              eq: () => ({
                not: () => ({
                  limit: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "profiles") {
          return {
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          };
        }
        return {
          insert: () => Promise.resolve({ error: null }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      },
      auth: {
        admin: {
          getUserById: () =>
            Promise.resolve({
              data: { user: { email: "member@test.com" } },
              error: null,
            }),
        },
      },
    } as never);

    const result = await acceptWorkspaceInvite("valid-token");
    expect(result.ok).toBe(true);
    expect(insertCalled).toBe(true);
    expect(inviteDeleted).toBe(false);
  });

  it("acceptWorkspaceInvite rebaixa para viewer e marca visitor quando convidado nao tem plano proprio", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "your_service_role_key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

    let insertedMember: Record<string, unknown> | null = null;
    let profileVisitorUpdated = false;
    let inviteDeleted = false;

    mockCreateClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u-no-plan", email: "guest@test.com" } } }) },
      rpc: () =>
        Promise.resolve({
          data: [
            {
              id: "inv-email-1",
              workspace_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
              email: "guest@test.com",
              role: "editor",
              invited_by: "u-owner",
            },
          ],
          error: null,
        }),
      from: (table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { onboarding_completed_at: null }, error: null }),
              }),
            }),
          };
        }
        return baseFrom(table);
      },
    } as never);

    mockCreateAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === "workspace_members") {
          return {
            select: (cols: string, opts?: { count?: string; head?: boolean }) => {
              if (opts?.count === "exact") {
                return {
                  eq: () => ({
                    not: () => Promise.resolve({ count: 0, data: null, error: null }),
                  }),
                };
              }
              return {
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: null, error: null }),
                  }),
                  not: () => Promise.resolve({ data: [], error: null }),
                }),
              };
            },
            insert: (payload: Record<string, unknown>) => {
              insertedMember = payload;
              return Promise.resolve({ error: null });
            },
          };
        }
        if (table === "workspaces") {
          return {
            select: () => ({
              eq: () => ({
                not: () => ({
                  limit: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "profiles") {
          return {
            update: () => ({
              eq: () => {
                profileVisitorUpdated = true;
                return Promise.resolve({ error: null });
              },
            }),
          };
        }
        if (table === "workspace_invites") {
          return {
            delete: () => ({
              eq: () => {
                inviteDeleted = true;
                return Promise.resolve({ error: null });
              },
            }),
          };
        }
        return {
          insert: () => Promise.resolve({ error: null }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      },
      auth: {
        admin: {
          getUserById: () =>
            Promise.resolve({
              data: { user: { email: "member@test.com" } },
              error: null,
            }),
        },
      },
    } as never);

    const result = await acceptWorkspaceInvite("valid-token-email");
    expect(result.ok).toBe(true);
    expect(insertedMember).toBeTruthy();
    expect(insertedMember?.role).toBe("viewer");
    expect(insertedMember?.granted_role).toBe("editor");
    expect(profileVisitorUpdated).toBe(true);
    expect(inviteDeleted).toBe(true);
  });

  it("acceptWorkspaceInvite mantem role do convite quando usuario ja possui plano proprio", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "your_service_role_key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

    let insertedMember: Record<string, unknown> | null = null;
    let profileVisitorUpdated = false;

    mockCreateClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u-pro", email: "pro@test.com" } } }) },
      rpc: () =>
        Promise.resolve({
          data: [
            {
              id: "inv-email-2",
              workspace_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
              email: "pro@test.com",
              role: "editor",
              invited_by: "u-owner",
            },
          ],
          error: null,
        }),
      from: (table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { onboarding_completed_at: "2026-01-01T00:00:00Z" }, error: null }),
              }),
            }),
          };
        }
        return baseFrom(table);
      },
    } as never);

    mockCreateAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === "workspace_members") {
          return {
            select: (cols: string, opts?: { count?: string; head?: boolean }) => {
              if (opts?.count === "exact") {
                return {
                  eq: () => ({
                    not: () => Promise.resolve({ count: 0, data: null, error: null }),
                  }),
                };
              }
              return {
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: null, error: null }),
                  }),
                  not: () => Promise.resolve({ data: [], error: null }),
                }),
              };
            },
            insert: (payload: Record<string, unknown>) => {
              insertedMember = payload;
              return Promise.resolve({ error: null });
            },
          };
        }
        if (table === "workspaces") {
          return {
            select: () => ({
              eq: () => ({
                not: () => ({
                  limit: () =>
                    Promise.resolve({
                      data: [{ id: "owned-pro-workspace" }],
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        if (table === "profiles") {
          return {
            update: () => ({
              eq: () => {
                profileVisitorUpdated = true;
                return Promise.resolve({ error: null });
              },
            }),
          };
        }
        if (table === "workspace_invites") {
          return {
            delete: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          };
        }
        return {
          insert: () => Promise.resolve({ error: null }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      },
      auth: {
        admin: {
          getUserById: () =>
            Promise.resolve({
              data: { user: { email: "member@test.com" } },
              error: null,
            }),
        },
      },
    } as never);

    const result = await acceptWorkspaceInvite("valid-token-pro");
    expect(result.ok).toBe(true);
    expect(insertedMember).toBeTruthy();
    expect(insertedMember?.role).toBe("editor");
    expect(insertedMember?.granted_role).toBe("editor");
    expect(profileVisitorUpdated).toBe(true);
  });

  it("acceptWorkspaceInvite mantem role do convite quando usuario tem beta ativo sem assinatura", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "your_service_role_key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

    let insertedMember: Record<string, unknown> | null = null;
    let profileVisitorUpdated = false;

    mockCreateClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u-beta", email: "beta@test.com" } } }) },
      rpc: () =>
        Promise.resolve({
          data: [
            {
              id: "inv-beta-1",
              workspace_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
              email: "beta@test.com",
              role: "editor",
              invited_by: "u-owner",
            },
          ],
          error: null,
        }),
      from: (table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { onboarding_completed_at: "2026-01-01T00:00:00Z" }, error: null }),
              }),
            }),
          };
        }
        return baseFrom(table);
      },
    } as never);

    mockCreateAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === "workspace_members") {
          return {
            select: (cols: string, opts?: { count?: string; head?: boolean }) => {
              if (opts?.count === "exact") {
                return {
                  eq: () => ({
                    not: () => Promise.resolve({ count: 0, data: null, error: null }),
                  }),
                };
              }
              return {
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: null, error: null }),
                  }),
                  not: () => Promise.resolve({ data: [], error: null }),
                }),
              };
            },
            insert: (payload: Record<string, unknown>) => {
              insertedMember = payload;
              return Promise.resolve({ error: null });
            },
          };
        }
        if (table === "workspaces") {
          // Sem assinatura própria
          return {
            select: () => ({
              eq: () => ({
                not: () => ({
                  limit: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "beta_participants") {
          return {
            select: () => ({
              eq: () => ({
                neq: () =>
                  Promise.resolve({
                    data: [{ beta_program_id: "prog-1", status: "active" }],
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === "beta_programs") {
          return {
            select: () => ({
              in: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [{ id: "prog-1", status: "active", ends_at: "2099-12-31T00:00:00Z" }],
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === "profiles") {
          return {
            update: () => ({
              eq: () => {
                profileVisitorUpdated = true;
                return Promise.resolve({ error: null });
              },
            }),
          };
        }
        if (table === "workspace_invites") {
          return {
            delete: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          };
        }
        return {
          insert: () => Promise.resolve({ error: null }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      },
      auth: {
        admin: {
          getUserById: () =>
            Promise.resolve({
              data: { user: { email: "member@test.com" } },
              error: null,
            }),
        },
      },
    } as never);

    const result = await acceptWorkspaceInvite("valid-token-beta");
    expect(result.ok).toBe(true);
    expect(insertedMember).toBeTruthy();
    expect(insertedMember?.role).toBe("editor");
    expect(insertedMember?.granted_role).toBe("editor");
    expect(profileVisitorUpdated).toBe(true);
  });

  it("acceptWorkspaceInvite bloqueia convite com email diferente do usuario logado", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "your_service_role_key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

    mockCreateClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u-mismatch", email: "actual@test.com" } } }) },
      rpc: () =>
        Promise.resolve({
          data: [
            {
              id: "inv-mismatch",
              workspace_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
              email: "other@test.com",
              role: "viewer",
              invited_by: "u-owner",
            },
          ],
          error: null,
        }),
    } as never);

    const result = await acceptWorkspaceInvite("token-mismatch");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("other@test.com");
    }
  });

  it("cancelWorkspaceInvite retorna erro sem usuario", async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
      from: () => ({}),
    } as never);

    const result = await cancelWorkspaceInvite("inv-1");
    expect(result.ok).toBe(false);
  });

  it("removeWorkspaceMember bloqueia auto-remocao", async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
      from: baseFrom,
    } as never);

    const result = await removeWorkspaceMember("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "u1");
    expect(result.ok).toBe(false);
  });

  it("removeWorkspaceMember usa fallback admin quando delete principal nao remove linhas", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "your_service_role_key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

    let adminDeleteCalled = false;

    mockCreateClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u-owner" } } }) },
      from: (table: string) => {
        if (table === "workspace_members") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  not: () => ({
                    single: () => Promise.resolve({ data: { role: "owner" }, error: null }),
                  }),
                  single: () => Promise.resolve({ data: { role: "viewer" }, error: null }),
                }),
              }),
            }),
            delete: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        return baseFrom(table);
      },
    } as never);

    mockCreateAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === "workspace_members") {
          return {
            delete: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => {
                    adminDeleteCalled = true;
                    return Promise.resolve({ data: [{ id: "wm-admin-1" }], error: null });
                  },
                }),
              }),
            }),
          };
        }
        return adminFrom(table);
      },
      auth: {
        admin: {
          getUserById: () =>
            Promise.resolve({
              data: { user: { email: "member@test.com" } },
              error: null,
            }),
        },
      },
    } as never);

    const result = await removeWorkspaceMember(
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      "u-target"
    );
    expect(result.ok).toBe(true);
    expect(adminDeleteCalled).toBe(true);
  });

  it("removeWorkspaceMember retorna erro quando nenhuma linha e removida e nao ha service role", async () => {
    const prevServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      mockCreateClient.mockResolvedValue({
        auth: { getUser: () => Promise.resolve({ data: { user: { id: "u-owner" } } }) },
        from: (table: string) => {
          if (table === "workspace_members") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    not: () => ({
                      single: () => Promise.resolve({ data: { role: "owner" }, error: null }),
                    }),
                    single: () => Promise.resolve({ data: { role: "viewer" }, error: null }),
                  }),
                }),
              }),
              delete: () => ({
                eq: () => ({
                  eq: () => ({
                    select: () => Promise.resolve({ data: [], error: null }),
                  }),
                }),
              }),
            };
          }
          return baseFrom(table);
        },
      } as never);

      const result = await removeWorkspaceMember(
        "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        "u-target"
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Nao foi possivel remover");
      }
    } finally {
      if (typeof prevServiceRoleKey === "string") {
        process.env["SUPABASE_SERVICE_ROLE_KEY"] = prevServiceRoleKey;
      } else {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      }
    }
  });

  it("acceptWorkspaceInvite nao bloqueia usuario ja membro quando workspace esta no limite", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "your_service_role_key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

    let countCheckCalled = false;

    mockCreateClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u2", email: "member@test.com" } } }) },
      rpc: () =>
        Promise.resolve({
          data: [
            {
              id: "inv-limit",
              workspace_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
              email: "link::guest::abc123",
              role: "editor",
              invited_by: "u1",
            },
          ],
          error: null,
        }),
      from: (table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { onboarding_completed_at: "2026-01-01T00:00:00Z" },
                    error: null,
                  }),
              }),
            }),
          };
        }
        return baseFrom(table);
      },
    } as never);

    mockCreateAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === "workspace_members") {
          return {
            select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
              if (opts?.count === "exact") {
                countCheckCalled = true;
                return {
                  eq: () => ({
                    not: () => Promise.resolve({ count: 3, data: null, error: null }),
                  }),
                };
              }
              return {
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () =>
                      Promise.resolve({
                        data: { id: "wm-1", accepted_at: "2026-01-01T00:00:00Z" },
                        error: null,
                      }),
                  }),
                  not: () => Promise.resolve({ data: [], error: null }),
                }),
              };
            },
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
            insert: () => Promise.resolve({ error: null }),
          };
        }
        if (table === "workspaces") {
          return {
            select: () => ({
              eq: () => ({
                not: () => ({
                  limit: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "profiles") {
          return {
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          };
        }
        if (table === "workspace_invites") {
          return {
            delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
          };
        }
        return {
          insert: () => Promise.resolve({ error: null }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      },
      auth: {
        admin: {
          getUserById: () =>
            Promise.resolve({
              data: { user: { email: "member@test.com" } },
              error: null,
            }),
        },
      },
    } as never);

    const result = await acceptWorkspaceInvite("token-at-limit");
    expect(result.ok).toBe(true);
    expect(countCheckCalled).toBe(false);
  });

  it("getWorkspaceInvites retorna [] com workspace nulo", async () => {
    const result = await getWorkspaceInvites(null);
    expect(result).toEqual([]);
  });

  it("getWorkspaceMembersWithProfiles retorna [] com workspace nulo", async () => {
    const result = await getWorkspaceMembersWithProfiles(null);
    expect(result).toEqual([]);
  });
});
