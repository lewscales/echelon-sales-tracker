"use client";

import { useState } from "react";
import { BRAND } from "@/lib/config";
import { formFor } from "@/lib/forms";
import { FieldList, missingRequired } from "./Forms";
import { Logo, api } from "./ui";

/** The client-facing onboarding questionnaire: public link, no login. */
export function OnboardingForm() {
  const form = formFor("onboarding")!;
  const [values, setValues] = useState<Record<string, string>>({});
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const missing = missingRequired(form.fields, values);
    if (missing) {
      setErr(`"${missing.label}" is required`);
      document.getElementById(`f-${missing.key}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      await api("/api/public/onboarding", "POST", { data: values, website });
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't send. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-cyan">
            <Logo size={36} />
          </span>
          <div className="display font-extrabold text-lg">{BRAND.client}</div>
        </div>
        {done ? (
          <div className="surface lit p-8 text-center space-y-3">
            <div className="text-4xl">🎉</div>
            <h1 className="display text-3xl font-extrabold">You&apos;re all set</h1>
            <p className="text-muted">Thanks for filling this in. The team has it and will be in touch with your next steps.</p>
          </div>
        ) : (
          <>
            <h1 className="display text-4xl font-extrabold tracking-tight">{form.title}</h1>
            <p className="text-muted mt-2 mb-6">{form.blurb}</p>
            <form onSubmit={submit} className="surface lit p-5 sm:p-6 space-y-5" noValidate>
              <FieldList fields={form.fields} values={values} set={(k, v) => setValues((s) => ({ ...s, [k]: v }))} />
              <input
                type="text"
                name="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute -left-[9999px] w-px h-px opacity-0"
              />
              {err && <p className="text-danger text-sm">{err}</p>}
              <button className="btn-primary w-full !py-3" disabled={busy}>
                {busy ? "Sending…" : "Send"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
