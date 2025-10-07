"use client";

import { FormEvent, useMemo, useState } from "react";
import { useCredits } from "@/app/(core)/credit-context";

interface Summary {
  total: number;
  unique: number;
  duplicates: number;
  cleaned: string[];
}

function normalize(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function buildSummary(rawInput: string): Summary {
  const entries = rawInput
    .split(/\r?\n|,|;|\s+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalize)
    .filter(Boolean);

  const uniqueSet = new Set<string>();
  const duplicates = new Set<string>();

  entries.forEach((value) => {
    if (uniqueSet.has(value)) {
      duplicates.add(value);
    }
    uniqueSet.add(value);
  });

  return {
    total: entries.length,
    unique: uniqueSet.size,
    duplicates: duplicates.size,
    cleaned: Array.from(uniqueSet),
  };
}

export default function NumerosPage() {
  const [input, setInput] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const { spend } = useCredits();

  const hasContent = useMemo(() => input.trim().length > 0, [input]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!hasContent) {
      setError("Ingresa uno o varios números para analizar.");
      return;
    }

    setProcessing(true);
    const ok = await spend(1);
    if (!ok) {
      setProcessing(false);
      setError("No fue posible descontar crédito.");
      return;
    }

    const result = buildSummary(input);
    setSummary(result);
    setProcessing(false);
  };

  return (
    <div className="page numbers-page">
      <header className="page-header">
        <h1>Normalizador de números</h1>
        <p>Depura listados de teléfonos o identificadores y elimina duplicados en un solo paso.</p>
      </header>
      <form className="numbers-form" onSubmit={handleSubmit}>
        <label>
          <span>Listado de números</span>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="3100000000, 3200000000, 6010000000"
            rows={8}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="primary" disabled={processing}>
          {processing ? "Procesando…" : "Procesar"}
        </button>
      </form>
      {summary && (
        <section className="numbers-summary">
          <h2>Resumen</h2>
          <div className="stats">
            <article>
              <span>Total ingresado</span>
              <strong>{summary.total}</strong>
            </article>
            <article>
              <span>Únicos</span>
              <strong>{summary.unique}</strong>
            </article>
            <article>
              <span>Duplicados</span>
              <strong>{summary.duplicates}</strong>
            </article>
          </div>
          <div className="cleaned">
            <header>
              <h3>Listado depurado</h3>
              <button
                type="button"
                className="ghost"
                onClick={() => navigator.clipboard.writeText(summary.cleaned.join("\n"))}
              >
                Copiar
              </button>
            </header>
            <pre>{summary.cleaned.join("\n")}</pre>
          </div>
        </section>
      )}
    </div>
  );
}
