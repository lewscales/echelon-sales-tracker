import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "./prisma";
import type { Member } from "@prisma/client";

const COOKIE = "ast_sid";

// Sessions are signed with AUTH_SECRET. No hardcoded fallback: a known secret
// would let anyone forge an admin cookie. Resolved lazily so a missing secret
// fails a real request, never the build.
function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.trim().length < 16) {
    throw new Error("AUTH_SECRET is missing (or too short). Set a long random AUTH_SECRET in the environment.");
  }
  return s;
}

function mac(value: string) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

function unsign(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx < 0) return null;
  const value = signed.slice(0, idx);
  const a = Buffer.from(signed.slice(idx + 1));
  const b = Buffer.from(mac(value));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return value;
}

export async function setSession(memberId: string) {
  const jar = await cookies();
  jar.set(COOKIE, `${memberId}.${mac(memberId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** The signed-in, active member — or null. */
export async function currentMember(): Promise<Member | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const id = unsign(raw);
  if (!id) return null;
  const m = await prisma.member.findUnique({ where: { id } });
  return m && m.active ? m : null;
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}
export const unauthorized = () => json({ error: "Please log in" }, 401);
export const forbidden = () => json({ error: "You don't have access to that" }, 403);

/** Constant-time string compare for shared secrets. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Login codes look like TRK-7QX4M — no 0/O/1/I to misread. */
export function newCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) s += alphabet[bytes[i] % alphabet.length];
  return `TRK-${s}`;
}
