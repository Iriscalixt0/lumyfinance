const DEFAULT_ADMIN_EMAILS = ["graphyx.ai@gmail.com"] as const;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getPrivilegedAdminEmails(): string[] {
  const envAdmins = (process.env.BETA_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);

  return [...new Set([...DEFAULT_ADMIN_EMAILS, ...envAdmins])];
}

export function isPrivilegedAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return getPrivilegedAdminEmails().includes(normalizeEmail(email));
}
