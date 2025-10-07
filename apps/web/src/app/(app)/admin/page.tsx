"use client";

import { useCredits } from "@/app/(core)/credit-context";

export default function AdminPage() {
  const { profile } = useCredits();

  return (
    <div className="page admin-page">
      <header className="page-header">
        <h1>Panel administrativo</h1>
        <p>Gestiona la información de tu cuenta y consulta métricas clave.</p>
      </header>
      <section className="admin-summary">
        <article>
          <span>Usuario</span>
          <strong>{profile?.generated_email || profile?.personal_email || "-"}</strong>
        </article>
        <article>
          <span>Plan activo</span>
          <strong>{profile?.plan ?? "-"}</strong>
        </article>
        <article>
          <span>Créditos restantes</span>
          <strong>{profile?.credits ?? "-"}</strong>
        </article>
      </section>
      <section className="admin-help">
        <h2>Soporte</h2>
        <p>
          Si necesitas habilitar nuevas funciones o delegar accesos, contáctanos en <a href="mailto:admin@wftools.com">admin@wftools.com</a>.
        </p>
        <p>Estamos migrando todos los módulos a la nueva plataforma React/Next.js para ofrecer mayor estabilidad.</p>
      </section>
    </div>
  );
}
