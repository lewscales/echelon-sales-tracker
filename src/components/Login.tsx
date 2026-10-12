"use client";

import { useState } from "react";
import { BRAND } from "@/lib/config";
import { Logo, api } from "./ui";

export function Login({ onDone }: { onDone: () => Promise<void> }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api("/api/auth/login", "POST", { code });
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login failed");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-5">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5 text-cyan" style={{ filter: "drop-shadow(0 0 18px rgb(var(--accent-rgb) / 0.6))" }}>
            <Logo size={60} />
          </div>
          <h1 className="display text-4xl sm:text-5xl font-extrabold tracking-tight plasma-text">{BRAND.name}</h1>
          <p className="text-muted mt-3">{BRAND.tagline}</p>
        </div>
        <form onSubmit={submit} className="surface lit p-6 space-y-3">
          <label className="label block" htmlFor="code">
            Your access code
          </label>
          <input
            id="code"
            className="input num !text-base tracking-wider uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="TRK-XXXXXX"
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          {err && <p className="text-danger text-sm">{err}</p>}
          <button className="btn-primary w-full !py-3" disabled={busy || !code.trim()}>
            {busy ? "Checking…" : "Log in"}
          </button>
          <p className="text-center text-faint text-xs pt-1">No password. Your admin gives you your code.</p>
        </form>
      </div>
    </div>
  );
}
