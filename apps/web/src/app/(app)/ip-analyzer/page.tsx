"use client";

import { FormEvent, useState } from "react";
import { useCredits } from "@/app/(core)/credit-context";

interface AnalysisResult {
  version: "IPv4" | "IPv6";
  isPrivate: boolean;
  classification: string;
  notes: string[];
}

function isValidIPv4(ip: string) {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const value = Number(part);
    return value >= 0 && value <= 255 && String(value) === String(Number(part));
  });
}

function isValidIPv6(ip: string) {
  return /^(?:[a-f0-9]{1,4}:){7}[a-f0-9]{1,4}$/i.test(ip);
}

function analyzeIpv4(ip: string): AnalysisResult {
  const octets = ip.split(".").map((value) => Number(value));
  const first = octets[0];
  const second = octets[1];
  const notes: string[] = [];
  let classification = "Pública";
  let isPrivate = false;

  if (first === 10) {
    isPrivate = true;
    classification = "Privada (Clase A)";
  } else if (first === 172 && second >= 16 && second <= 31) {
    isPrivate = true;
    classification = "Privada (Clase B)";
  } else if (first === 192 && second === 168) {
    isPrivate = true;
    classification = "Privada (Clase C)";
  } else if (first === 127) {
    notes.push("Loopback / localhost");
  } else if (first >= 224 && first <= 239) {
    classification = "Multicast";
  } else if (first >= 240) {
    classification = "Reservada";
  }

  if (first === 100 && second >= 64 && second <= 127) {
    notes.push("Carrier Grade NAT (RFC 6598)");
  }
  if (first === 169 && second === 254) {
    notes.push("Dirección APIPA autoasignada");
  }

  return {
    version: "IPv4",
    isPrivate,
    classification,
    notes,
  };
}

function analyzeIpv6(ip: string): AnalysisResult {
  const notes: string[] = [];
  let classification = "Global Unicast";
  let isPrivate = false;
  const lower = ip.toLowerCase();

  if (lower.startsWith("fc") || lower.startsWith("fd")) {
    classification = "Unique Local Address";
    isPrivate = true;
  } else if (lower.startsWith("fe80")) {
    classification = "Link-local";
    isPrivate = true;
  } else if (lower.startsWith("ff")) {
    classification = "Multicast";
  }

  return {
    version: "IPv6",
    isPrivate,
    classification,
    notes,
  };
}

export default function IpAnalyzerPage() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { spend } = useCredits();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    const candidate = input.trim();
    if (!candidate) {
      setError("Ingresa una IP a analizar.");
      return;
    }

    let analysis: AnalysisResult | null = null;
    if (isValidIPv4(candidate)) {
      analysis = analyzeIpv4(candidate);
    } else if (isValidIPv6(candidate)) {
      analysis = analyzeIpv6(candidate);
    } else {
      setError("Formato de IP no válido.");
      return;
    }

    setLoading(true);
    const ok = await spend(1);
    if (!ok) {
      setLoading(false);
      setError("No fue posible descontar crédito.");
      return;
    }

    setResult(analysis);
    setLoading(false);
  };

  return (
    <div className="page ip-page">
      <header className="page-header">
        <h1>Analizador de IP</h1>
        <p>Clasifica rápidamente direcciones IPv4 o IPv6 y determina su naturaleza pública o privada.</p>
      </header>
      <form className="ip-form" onSubmit={handleSubmit}>
        <label>
          <span>Dirección IP</span>
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="e.g. 190.85.120.10"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="primary" disabled={loading}>
          {loading ? "Analizando…" : "Analizar"}
        </button>
      </form>
      {result && (
        <section className="ip-result">
          <h2>Resultado</h2>
          <ul>
            <li>
              <span>Versión:</span>
              <strong>{result.version}</strong>
            </li>
            <li>
              <span>Clasificación:</span>
              <strong>{result.classification}</strong>
            </li>
            <li>
              <span>Alcance:</span>
              <strong>{result.isPrivate ? "Privada" : "Pública"}</strong>
            </li>
          </ul>
          {result.notes.length > 0 && (
            <div className="notes">
              <h3>Notas</h3>
              <ul>
                {result.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
