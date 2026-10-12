"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BRAND, ROLES } from "@/lib/config";
import type { DataBundle } from "@/lib/types";
import { Logo, Toast, api } from "./ui";
import { Login } from "./Login";
import { Dashboard } from "./Dashboard";
import { EodReports } from "./EodReports";
import { Forms } from "./Forms";
import { Admin } from "./Admin";
import { Applications } from "./Applications";
import { Students } from "./Students";
import { CallDrawer } from "./CallDrawer";

export type Ctx = {
  data: DataBundle;
  /** Member id → display name ("Unassigned" for null/unknown). */
  nameOf: (id: string | null | undefined) => string;
  reload: () => Promise<void>;
  toast: (text: string) => void;
  /** Open the full view of one booked call (lead, application, handoff, report). */
  openCall: (id: string) => void;
};

type Tab = "dashboard" | "applications" | "eod" | "forms" | "students" | "admin";
const TABS: { id: Tab; label: string; adminOnly?: boolean }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "applications", label: "Applications" },
  { id: "eod", label: "EOD Reports" },
  { id: "forms", label: "Forms" },
  { id: "students", label: "Students", adminOnly: true },
  { id: "admin", label: "Admin", adminOnly: true },
];

function tabFromHash(): Tab {
  if (typeof window === "undefined") return "dashboard";
  const h = window.location.hash.replace("#", "").split("/")[0];
  return (TABS.some((t) => t.id === h) ? h : "dashboard") as Tab;
}

export function App() {
  const [data, setData] = useState<DataBundle | null>(null);
  const [state, setState] = useState<"loading" | "login" | "ready" | "error">("loading");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [toastText, setToastText] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch("/api/data", { cache: "no-store" });
    if (res.status === 401) {
      setData(null);
      setState("login");
      return;
    }
    if (!res.ok) {
      setState("error");
      return;
    }
    setData(await res.json());
    setState("ready");
  }, []);

  useEffect(() => {
    setTab(tabFromHash());
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    reload();
    // Keep the board current: new bookings and reports show up without a manual refresh.
    const tick = () => document.visibilityState === "visible" && reload();
    const timer = window.setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [reload]);

  const names = useMemo(() => new Map((data?.members ?? []).map((m) => [m.id, m.name])), [data]);
  const nameOf = useCallback((id: string | null | undefined) => (id ? names.get(id) ?? "Former member" : "Unassigned"), [names]);

  if (state === "loading") {
    return (
      <div className="min-h-screen grid place-items-center">
        <span className="text-cyan animate-pulse">
          <Logo size={44} />
        </span>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <p className="text-muted">The tracker couldn&apos;t load. Check your connection and try again.</p>
          <button className="btn-primary mt-4" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
  if (state === "login" || !data) return <Login onDone={reload} />;

  const ctx: Ctx = { data, nameOf, reload, toast: setToastText, openCall: setCallId };
  const visible = TABS.filter((t) => !t.adminOnly || data.me.role === "admin");
  const current = visible.some((t) => t.id === tab) ? tab : "dashboard";

  async function logout() {
    await api("/api/auth/logout", "POST").catch(() => null);
    setData(null);
    setState("login");
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b hair bg-bg/90 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
          <div className="flex items-center gap-3 h-16">
            <span className="shrink-0">
              <Logo size={30} />
            </span>
            <div className="min-w-0">
              <div className="display font-semibold text-[15px] leading-tight truncate">{BRAND.name}</div>
            </div>
            <nav className="hidden md:flex items-center gap-1 ml-8" aria-label="Main">
              {visible.map((t) => (
                <a
                  key={t.id}
                  href={`#${t.id}`}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    current === t.id ? "bg-surface2 text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {t.label}
                </a>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <div className="text-sm font-semibold leading-tight">{data.me.name}</div>
                <div className="text-[11px] text-faint leading-tight">{ROLES[data.me.role]}</div>
              </div>
              <button className="btn-ghost !px-3 !py-2 !text-xs" onClick={logout}>
                Log out
              </button>
            </div>
          </div>
          <nav className="md:hidden flex gap-1 -mx-1 pb-2 overflow-x-auto" aria-label="Main">
            {visible.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                className={`rounded-xl px-3 py-1.5 text-sm font-semibold whitespace-nowrap ${
                  current === t.id ? "bg-white/[0.08] text-ink" : "text-muted"
                }`}
              >
                {t.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6 sm:py-8">
        {current === "dashboard" && <Dashboard ctx={ctx} />}
        {current === "applications" && <Applications ctx={ctx} />}
        {current === "eod" && <EodReports ctx={ctx} />}
        {current === "forms" && <Forms ctx={ctx} />}
        {current === "students" && <Students ctx={ctx} />}
        {current === "admin" && <Admin ctx={ctx} />}
      </main>

      {callId && <CallDrawer ctx={ctx} callId={callId} onClose={() => setCallId(null)} />}
      {toastText && <Toast text={toastText} onDone={() => setToastText(null)} />}
    </div>
  );
}
