import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, createSessionToken, type Role } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

function roleForPin(pin: string): Role | null {
  if (process.env.OWNER_PIN && pin === process.env.OWNER_PIN) return "OWNER";
  if (process.env.STAFF_PIN && pin === process.env.STAFF_PIN) return "STAFF";
  return null;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const pin = typeof body.pin === "string" ? body.pin : "";
  const role = roleForPin(pin);

  if (!role) {
    await recordAuditLog({
      action: "LOGIN_FAILED",
      entityType: "Auth",
      description: "เข้าสู่ระบบไม่สำเร็จ"
    });
    return NextResponse.json({ error: "รหัส PIN ไม่ถูกต้อง" }, { status: 401 });
  }

  await recordAuditLog({
    actorRole: role,
    action: "LOGIN_SUCCESS",
    entityType: "Auth",
    description: "เข้าสู่ระบบสำเร็จ"
  });

  const response = NextResponse.json({ ok: true, role });
  response.cookies.set(AUTH_COOKIE, createSessionToken(role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60
  });
  return response;
}
