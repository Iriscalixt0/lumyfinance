import { redirect } from "next/navigation";

export default async function ShortInvitePage({
  params,
}: {
  params: { locale: string; token: string } | Promise<{ locale: string; token: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const locale = resolvedParams.locale || "pt-BR";
  const token = resolvedParams.token?.trim();
  
  if (!token) {
    redirect(`/${locale}/invite/accept?error=token_missing`);
    return;
  }
  
  // Token base64url é seguro em query; evita double-encoding
  const safeToken = /^[A-Za-z0-9_-]+$/.test(token) ? token : encodeURIComponent(token);
  redirect(`/${locale}/invite/accept?token=${safeToken}`);
}
