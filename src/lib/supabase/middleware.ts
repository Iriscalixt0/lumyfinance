import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { assertSupabaseConfigIsSafe } from "@/lib/supabase/config";
import { isPrivilegedAdminEmail } from "@/lib/admin-access";

function getPathWithoutLocale(pathname: string): { path: string; locale: string | null } {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (first && routing.locales.includes(first as (typeof routing.locales)[number])) {
    return {
      path: "/" + segments.slice(1).join("/"),
      locale: first,
    };
  }
  return { path: pathname, locale: null };
}

function isEmailConfirmed(
  user: { email_confirmed_at?: string | null; confirmed_at?: string | null } | null | undefined
): boolean {
  return !!(user?.email_confirmed_at || user?.confirmed_at);
}

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.next({ request });
  }

  assertSupabaseConfigIsSafe(url, key);

  const response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const { path, locale } = getPathWithoutLocale(pathname);
  const prefix = locale ? `/${locale}` : "";
  const onboardCookieValue = request.cookies.get("nf_onboard")?.value;
  const hasOnboardCookie = !!user && onboardCookieValue === user.id;

  if (user && onboardCookieValue && onboardCookieValue !== user.id) {
    response.cookies.delete("nf_onboard");
  }
  const emailConfirmed = isEmailConfirmed(user);

  if (user && !emailConfirmed) {
    await supabase.auth.signOut();

    const isPublicAuthRoute =
      path.startsWith("/login") ||
      path.startsWith("/register") ||
      path.startsWith("/forgot-password") ||
      path.startsWith("/reset-password");

    if (!isPublicAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = `${prefix || "/pt-BR"}/login`;
      url.searchParams.set("error", "email_not_confirmed");
      const redirectResponse = NextResponse.redirect(url);
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      });
      return redirectResponse;
    }
  }

  if (!user && path.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}/login`;
    return NextResponse.redirect(url);
  }

  if (!user && path.startsWith("/onboarding")) {
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}/login`;
    return NextResponse.redirect(url);
  }

  // Permite usuários logados em /reset-password (fluxo de recuperação) e /forgot-password (redefinir senha pelo perfil)
  if (user && (path.startsWith("/reset-password") || path.startsWith("/forgot-password"))) {
    return response;
  }

  // Uma única leitura de profile por request quando precisamos de onboarding_completed_at
  const needsOnboardingCheck =
    path === "/" ||
    path === "" ||
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/onboarding") ||
    path.startsWith("/dashboard");
  let onboardingComplete = hasOnboardCookie;
  if (user && needsOnboardingCheck && !hasOnboardCookie) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", user.id)
      .single();
    onboardingComplete = !!profile?.onboarding_completed_at;
    if (onboardingComplete) {
      response.cookies.set("nf_onboard", user.id, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        httpOnly: false,
        sameSite: "lax",
      });
    }
  }

  if (
    user &&
    (path === "/" ||
      path === "" ||
      path.startsWith("/login") ||
      path.startsWith("/register"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}${onboardingComplete ? "/dashboard" : "/onboarding"}`;
    return NextResponse.redirect(url);
  }

  if (user && path.startsWith("/onboarding")) {
    if (onboardingComplete) {
      const url = request.nextUrl.clone();
      url.pathname = `${prefix}/dashboard`;
      return NextResponse.redirect(url);
    }
  }

  // Usuário autenticado acessando dashboard sem ter completado onboarding → redireciona para onboarding
  if (user && path.startsWith("/dashboard")) {
    if (!onboardingComplete) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `${prefix}/onboarding`;
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Proteção /admin: apenas BETA_ADMIN_EMAILS
  const isBetaAdmin = isPrivilegedAdminEmail(user?.email);
  if (path.startsWith("/admin")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = `${prefix || "/pt-BR"}/login`;
      return NextResponse.redirect(url);
    }
    if (!isBetaAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = `${prefix || "/pt-BR"}/dashboard`;
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Bypass Stripe para admins beta
  if (isBetaAdmin) {
    return response;
  }

  // Bloqueia uso do app sem assinatura Pro (exceto beta ativo ou beta encerrado — modal aparece no dashboard)
  // Usa RPC check_dashboard_access para consolidar queries em uma única round-trip.
  if (user && path.startsWith("/dashboard") && !path.startsWith("/dashboard/settings") && !path.startsWith("/dashboard/beta/")) {
    const workspaceIdFromCookie = request.cookies.get("workspace_id")?.value ?? null;
    const { data: accessRows, error } = await supabase.rpc("check_dashboard_access", {
      p_workspace_id: workspaceIdFromCookie,
    });
    if (!error && accessRows?.[0]) {
      const { can_access, redirect_to } = accessRows[0] as { can_access: boolean; redirect_to: string | null };
      if (!can_access && redirect_to) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = `${prefix}${redirect_to}`;
        return NextResponse.redirect(redirectUrl);
      }
      return response;
    }
    // Fallback se RPC não existir (migration não aplicada): lógica original em múltiplas queries
    if (error) {
      let workspaceId = workspaceIdFromCookie;
      if (!workspaceId) {
        const { data: members } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", user.id)
          .not("accepted_at", "is", null)
          .limit(1);
        workspaceId = members?.[0]?.workspace_id;
      }
      if (workspaceId) {
        const { data: ws } = await supabase
          .from("workspaces")
          .select("plan, stripe_subscription_id, beta_program_id")
          .eq("id", workspaceId)
          .single();
        if (ws && !ws.stripe_subscription_id) {
          if (ws.beta_program_id) {
            const { data: prog } = await supabase
              .from("beta_programs")
              .select("status, ends_at")
              .eq("id", ws.beta_program_id)
              .single();
            if (prog?.status === "blocked") {
              const { data: part } = await supabase
                .from("beta_participants")
                .select("feedback_upgraded")
                .eq("user_id", user.id)
                .eq("workspace_id", workspaceId)
                .maybeSingle();
              if (part && !part.feedback_upgraded) {
                const blockedUrl = request.nextUrl.clone();
                blockedUrl.pathname = `${prefix}/dashboard/beta/blocked`;
                return NextResponse.redirect(blockedUrl);
              }
            }
            return response;
          }
          // Sem assinatura e sem beta: deixa passar (usuário pode navegar; ações bloqueiam no client e redirecionam para /dashboard/plan)
        }
      }
    }
  }

  return response;
}
