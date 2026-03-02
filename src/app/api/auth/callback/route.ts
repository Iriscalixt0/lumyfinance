import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Callback de autenticação do Supabase (PKCE).
 * - Confirmação de email (signup): Supabase redireciona aqui com ?code=xxx (sem "next").
 *   Redirecionamos para /login para o usuário entrar.
 * - Recuperação de senha: forgot-password envia redirectTo com next=/pt-BR/reset-password,
 *   então o link do email traz next e redirecionamos para reset-password.
 */
export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const defaultLocale = "pt-BR";
  // Sem "next": confirmação de email → login. Com "next": ex. recuperação de senha → reset-password.
  let next = searchParams.get("next") ?? `/${defaultLocale}/login`;
  if (next.startsWith("/") && !next.startsWith("/pt-BR/") && !next.startsWith("/pt-PT/") && !next.startsWith("/en/") && !next.startsWith("/es/")) {
    next = `/${defaultLocale}${next === "/" ? "" : next}`;
  }

  if (!code) {
    return NextResponse.redirect(new URL(`/${defaultLocale}/login?error=missing_code`, request.url));
  }

  const response = NextResponse.redirect(new URL(next, request.url));

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

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/${defaultLocale}/login?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  return response;
}
