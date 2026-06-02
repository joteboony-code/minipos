import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "minimart_session";
const staffPages = new Set(["/pos", "/sales"]);
const publicPaths = new Set(["/login"]);

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(process.env.AUTH_SECRET || "dev-only-change-me"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function roleFromToken(token?: string) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if ((await sign(payload)) !== signature) return null;

  try {
    const session = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as { role?: string; exp?: number };
    if (!session.exp || session.exp < Date.now()) return null;
    return session.role === "OWNER" || session.role === "STAFF" ? session.role : null;
  } catch {
    return null;
  }
}

function apiAllowed(pathname: string, method: string, role: string) {
  if (role === "OWNER") return true;
  if (pathname === "/api/auth/logout" || pathname === "/api/auth/me") return true;
  if (pathname === "/api/promptpay") return true;
  if (pathname === "/api/sales") return method === "GET" || method === "POST";
  if (pathname === "/api/products") return method === "GET";
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (publicPaths.has(pathname) || pathname.startsWith("/api/auth/login")) return NextResponse.next();

  const role = await roleFromToken(request.cookies.get(AUTH_COOKIE)?.value);
  const isApi = pathname.startsWith("/api/");

  if (!role) {
    if (isApi) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isApi && !apiAllowed(pathname, request.method, role)) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงหน้านี้" }, { status: 403 });
  }

  if (!isApi && role === "STAFF" && !staffPages.has(pathname)) {
    return NextResponse.redirect(new URL("/pos", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)"]
};
