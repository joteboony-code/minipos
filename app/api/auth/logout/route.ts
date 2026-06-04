import { NextResponse } from "next/server";
import { AUTH_COOKIE, getSession } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

export async function POST() {
  const session = await getSession();
  await recordAuditLog({
    actorRole: session?.role ?? null,
    action: "LOGOUT",
    entityType: "Auth",
    description: "ออกจากระบบ"
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}
