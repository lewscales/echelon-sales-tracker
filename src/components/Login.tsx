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
          <div className="flex justify-center mb-6">
            <Logo size={52} />
          </div>
          <h1 className="display text-3xl sm:text-4xl font-semibold text-white">{BRAND.name}</h1>
          <p className="text-muted mt-2">{BRAND.tagline}</p>
        </div>
        <form onSubmit={submit} className="surface p-6 space-y-3">
          <label className="label block" htmlFor="code">
            Access code
          </label>
          <input
            id="code"
            className="input num !text-base tracking-wider uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="TRK-ABC123"
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          {err && <p className="text-danger text-sm">{err}</p>}
          <button className="btn-primary w-full !py-3" disabled={busy || !code.trim()}>
            {busy ? "Checking…" : "Log in"}
          </button>
          <p className="text-center text-faint text-xs pt-1">No code? Ask Danny for one.</p>
        </form>
      </div>
    </div>
  );
}
