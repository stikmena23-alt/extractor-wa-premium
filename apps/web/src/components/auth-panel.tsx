"use client";

import { FormEvent, useState } from "react";
import { useCredits } from "@/app/(core)/credit-context";

interface AuthPanelProps {
  errorMessage?: string;
}

export function AuthPanel({ errorMessage }: AuthPanelProps) {
  const { signIn, status, lastError } = useCredits();
  const [email, setEmail] = useState("admin.devinsonmq@wftools.com");
  const [password, setPassword] = useState("1003933222");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setPending(true);
    const ok = await signIn({ email, password });
    if (!ok) {
      setFormError("Credenciales incorrectas o cuenta inactiva.");
    }
    setPending(false);
  };

  return (
    <div className="auth-panel">
      <div className="auth-card">
        <header>
          <h1>WF Tools Premium</h1>
          <p>Inicia sesión para acceder a tus herramientas.</p>
        </header>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Correo electrónico</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {(formError || errorMessage || lastError) && (
            <p className="auth-error">{formError || errorMessage || lastError}</p>
          )}
          <button type="submit" disabled={pending || status === "loading"}>
            {pending ? "Verificando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
