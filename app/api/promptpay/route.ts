import QRCode from "qrcode";
import { NextRequest, NextResponse } from "next/server";
import { createPromptPayPayload } from "@/lib/promptpay";

export async function GET(request: NextRequest) {
  const amount = Number(request.nextUrl.searchParams.get("amount") ?? 0);
  const promptPayId = process.env.PROMPTPAY_ID ?? "";

  if (!promptPayId.trim()) {
    return NextResponse.json({ configured: false, message: "ยังไม่ได้ตั้งค่าเลขพร้อมเพย์" });
  }

  try {
    const payload = createPromptPayPayload(promptPayId, amount);
    const qrDataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240
    });

    return NextResponse.json({ configured: true, qrDataUrl });
  } catch (error) {
    return NextResponse.json({ configured: false, message: error instanceof Error ? error.message : "สร้าง QR พร้อมเพย์ไม่สำเร็จ" }, { status: 400 });
  }
}
