import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

export type Role = "OWNER" | "STAFF";
export type Session = { role: Role; exp: number };

export const AUTH_COOKIE = "minimart_session";
const SESSION_DAYS = 7;

function secret() {
  return process.env.AUTH_SECRET || "dev-only-change-me";
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(role: Role) {
  const session: Session = {
    role,
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  };
  const payload = base64Url(JSON.stringify(session));
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token?: string): Session | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    if (!["OWNER", "STAFF"].includes(session.role)) return null;
    if (!Number.isFinite(session.exp) || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(AUTH_COOKIE)?.value);
}

export async function requireRole(roles: Role[]) {
  const session = await getSession();
  if (!session) throw new Error("กรุณาเข้าสู่ระบบ");
  if (!roles.includes(session.role)) throw new Error("ไม่มีสิทธิ์เข้าถึงหน้านี้");
  return session;
}

export function roleLabel(role: Role) {
  return role === "OWNER" ? "เจ้าของร้าน" : "พนักงาน";
}
