import { prisma } from "@/lib/prisma";

export type AppSettings = {
  storeName: string;
  receiptFooter: string;
  defaultReceiptSize: "58" | "80" | "a4";
  enableCreditSales: boolean;
  requireOpenShiftBeforeSale: boolean;
  lowStockDashboardLimit: number;
  backupReminderEnabled: boolean;
};

export const defaultSettings: AppSettings = {
  storeName: "MiniMart POS",
  receiptFooter: "",
  defaultReceiptSize: "80",
  enableCreditSales: true,
  requireOpenShiftBeforeSale: false,
  lowStockDashboardLimit: 20,
  backupReminderEnabled: true
};

function parseBool(value: string | undefined, fallback: boolean) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function parseReceiptSize(value: string | undefined): AppSettings["defaultReceiptSize"] {
  return value === "58" || value === "80" || value === "a4" ? value : defaultSettings.defaultReceiptSize;
}

export async function getAppSettings(): Promise<AppSettings> {
  const rows = await prisma.appSetting.findMany();
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const lowStockDashboardLimit = Number(map.get("lowStockDashboardLimit"));
  return {
    storeName: map.get("storeName") ?? defaultSettings.storeName,
    receiptFooter: map.get("receiptFooter") ?? defaultSettings.receiptFooter,
    defaultReceiptSize: parseReceiptSize(map.get("defaultReceiptSize")),
    enableCreditSales: parseBool(map.get("enableCreditSales"), defaultSettings.enableCreditSales),
    requireOpenShiftBeforeSale: parseBool(map.get("requireOpenShiftBeforeSale"), defaultSettings.requireOpenShiftBeforeSale),
    lowStockDashboardLimit: Number.isInteger(lowStockDashboardLimit) && lowStockDashboardLimit > 0 ? lowStockDashboardLimit : defaultSettings.lowStockDashboardLimit,
    backupReminderEnabled: parseBool(map.get("backupReminderEnabled"), defaultSettings.backupReminderEnabled)
  };
}

export async function saveAppSettings(settings: AppSettings) {
  const entries: Array<[keyof AppSettings, string]> = [
    ["storeName", settings.storeName],
    ["receiptFooter", settings.receiptFooter],
    ["defaultReceiptSize", settings.defaultReceiptSize],
    ["enableCreditSales", String(settings.enableCreditSales)],
    ["requireOpenShiftBeforeSale", String(settings.requireOpenShiftBeforeSale)],
    ["lowStockDashboardLimit", String(settings.lowStockDashboardLimit)],
    ["backupReminderEnabled", String(settings.backupReminderEnabled)]
  ];
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value }
      })
    )
  );
}
