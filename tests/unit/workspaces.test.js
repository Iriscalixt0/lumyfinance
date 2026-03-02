import { describe, expect, it } from 'vitest';
import { getWorkspaceById, resolveWorkspaceForUser } from '@/lib/workspaces';

describe('workspaces', () => {
  it('resolve workspace by user metadata', () => {
    const user = {
      email: 'qualquer@dominio.com',
      user_metadata: { workspace: 'lumyf' }
    };

    const workspace = resolveWorkspaceForUser(user);
    expect(workspace?.id).toBe('lumyf');
  });

  it('falls back to graphyx for unknown id', () => {
    const workspace = getWorkspaceById('inexistente');
    expect(workspace.id).toBe('graphyx');
  });

  it('resolves graphyx admin email', () => {
    const user = { email: 'graphyx.ai@gmail.com' };
    const workspace = resolveWorkspaceForUser(user);
    expect(workspace?.id).toBe('graphyx');
  });
});

