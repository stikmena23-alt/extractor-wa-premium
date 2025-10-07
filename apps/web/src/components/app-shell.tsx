"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useMemo } from "react";
import { useCredits } from "@/app/(core)/credit-context";
import { AuthPanel } from "@/components/auth-panel";

interface AppShellProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { href: "/extractor", label: "Extractor" },
  { href: "/ip-analyzer", label: "Analizador IP" },
  { href: "/numeros", label: "Números" },
  { href: "/crediboost", label: "CrediBoost" },
  { href: "/admin", label: "Panel Admin" },
];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { status, credits, profile, lastError, refreshing, refresh, signOut } =
    useCredits();

  const content = useMemo(() => {
    if (status === "loading") {
      return (
        <div className="app-loading">
          <span className="spinner" aria-hidden />
          <p>Cargando sesión…</p>
        </div>
      );
    }

    if (status === "unauthenticated" || (status === "error" && !profile)) {
      return <AuthPanel errorMessage={lastError ?? undefined} />;
    }

    return null;
  }, [status, profile, lastError]);

  if (content) {
    return content;
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand">
          <div className="brand-mark">WF</div>
          <div className="brand-copy">
            <h1>WF Tools</h1>
            <p>{profile?.plan ? `Plan ${profile.plan}` : "Suite Premium"}</p>
          </div>
        </div>
        <nav aria-label="Secciones principales">
          <ul>
            {NAV_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <li key={item.href} className={isActive ? "active" : undefined}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <button
            className="secondary"
            type="button"
            onClick={() => refresh()}
            disabled={refreshing}
          >
            {refreshing ? "Actualizando…" : "Refrescar créditos"}
          </button>
          <button className="ghost" type="button" onClick={() => signOut()}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="app-main">
        <header className="app-header">
          <div>
            <h2 className="app-title">{NAV_ITEMS.find((item) => pathname.startsWith(item.href))?.label ?? "Dashboard"}</h2>
            {lastError && <p className="app-error">{lastError}</p>}
          </div>
          <div className="credit-chip" role="status" aria-live="polite">
            <span className="credit-label">Créditos disponibles</span>
            <span className="credit-value">
              {credits != null ? credits : "—"}
            </span>
          </div>
        </header>
        <div className="app-content">{children}</div>
      </main>
    </div>
  );
}
