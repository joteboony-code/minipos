function tlv(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function crc16Ccitt(input: string) {
  let crc = 0xffff;
  for (let index = 0; index < input.length; index += 1) {
    crc ^= input.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function promptPayTarget(id: string) {
  const compact = id.replace(/[\s-]/g, "");
  if (/^0\d{9}$/.test(compact)) {
    return { tag: "01", value: `0066${compact.slice(1)}` };
  }
  if (/^\d{13}$/.test(compact)) {
    return { tag: "02", value: compact };
  }
  if (/^\d{15}$/.test(compact)) {
    return { tag: "03", value: compact };
  }
  throw new Error("เลขพร้อมเพย์ไม่ถูกต้อง");
}

export function createPromptPayPayload(promptPayId: string, amount: number) {
  if (!promptPayId.trim()) throw new Error("ยังไม่ได้ตั้งค่าเลขพร้อมเพย์");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("ยอดโอนไม่ถูกต้อง");

  const target = promptPayTarget(promptPayId);
  const merchantAccount = tlv("00", "A000000677010111") + tlv(target.tag, target.value);
  const amountText = amount.toFixed(2);
  const payloadWithoutCrc =
    tlv("00", "01") +
    tlv("01", "12") +
    tlv("29", merchantAccount) +
    tlv("53", "764") +
    tlv("54", amountText) +
    tlv("58", "TH") +
    "6304";

  return `${payloadWithoutCrc}${crc16Ccitt(payloadWithoutCrc)}`;
}
