import { NextRequest, NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { defaultSettings, getAppSettings, saveAppSettings, type AppSettings } from "@/lib/settings";

function parseSettings(body: Record<string, unknown>): AppSettings {
  const receiptSize = body.defaultReceiptSize === "58" || body.defaultReceiptSize === "80" || body.defaultReceiptSize === "a4" ? body.defaultReceiptSize : defaultSettings.defaultReceiptSize;
  const limit = Number(body.lowStockDashboardLimit);
  return {
    storeName: typeof body.storeName === "string" && body.storeName.trim() ? body.storeName.trim() : defaultSettings.storeName,
    receiptFooter: typeof body.receiptFooter === "string" ? body.receiptFooter.trim() : "",
    defaultReceiptSize: receiptSize,
    enableCreditSales: Boolean(body.enableCreditSales),
    requireOpenShiftBeforeSale: Boolean(body.requireOpenShiftBeforeSale),
    lowStockDashboardLimit: Number.isInteger(limit) && limit > 0 && limit <= 100 ? limit : defaultSettings.lowStockDashboardLimit,
    backupReminderEnabled: Boolean(body.backupReminderEnabled)
  };
}

export async function GET() {
  try {
    await requireRole(["OWNER", "STAFF"]);
    return NextResponse.json(await getAppSettings());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "โหลดการตั้งค่าไม่สำเร็จ" }, { status: 403 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireRole(["OWNER"]);
    const body = await request.json();
    const settings = parseSettings(body && typeof body === "object" ? body as Record<string, unknown> : {});
    await saveAppSettings(settings);
    await recordAuditLog({
      actorRole: session.role,
      action: "SETTINGS_UPDATED",
      entityType: "AppSetting",
      description: "อัปเดตการตั้งค่าร้าน",
      metadata: settings
    });
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "บันทึกการตั้งค่าไม่สำเร็จ" }, { status: 400 });
  }
}
