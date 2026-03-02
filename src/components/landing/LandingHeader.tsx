"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/logo";
import { Menu, X } from "lucide-react";

export function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border overflow-x-hidden">
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between" aria-label="Principal">
        <Link href="/" className="flex items-center gap-2 text-foreground font-bold text-lg sm:text-xl hover:opacity-90 transition-opacity shrink-0">
          <Logo size="sm" />
          <span className="text-gradient-hero">Lumyf</span>
        </Link>
        <div className="hidden sm:flex items-center gap-6 md:gap-8">
          <a href="#produto" className="text-muted-foreground hover:text-foreground font-medium transition-colors text-sm">
            Produto
          </a>
          <a href="#planos" className="text-muted-foreground hover:text-foreground font-medium transition-colors text-sm">
            Planos
          </a>
        </div>
        <div className="hidden sm:flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            href="/login"
            className="text-muted-foreground font-semibold hover:text-foreground transition-colors px-3 sm:px-4 py-2 text-sm"
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className="bg-hero-gradient text-primary-foreground px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Cadastrar
          </Link>
        </div>
        <button
          type="button"
          className="sm:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-foreground hover:bg-secondary transition-colors shrink-0"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>
      {mobileOpen && (
        <div className="sm:hidden border-t border-border bg-background px-4 pb-4 pt-3 space-y-2">
          <a
            href="#produto"
            className="block py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMobileOpen(false)}
          >
            Produto
          </a>
          <a
            href="#planos"
            className="block py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMobileOpen(false)}
          >
            Planos
          </a>
          <div className="pt-2 space-y-2 border-t border-border">
            <Link
              href="/login"
              className="block w-full rounded-lg border border-border px-5 py-2.5 text-center text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="block w-full bg-hero-gradient text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-lg text-center"
              onClick={() => setMobileOpen(false)}
            >
              Cadastrar
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
