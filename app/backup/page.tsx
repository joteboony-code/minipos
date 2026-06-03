import { LocalBackupButton } from "./local-backup-button";

const exports = [
  {
    href: "/api/backup?type=full",
    title: "ส่งออกข้อมูลทั้งหมด",
    description: "ดาวน์โหลด JSON รวม categories, products, sales, saleItems และ stockMovements",
    button: "ดาวน์โหลด JSON"
  },
  {
    href: "/api/backup?type=products",
    title: "ส่งออกสินค้า",
    description: "ดาวน์โหลด CSV รายการสินค้า ราคาทุน ราคาขาย สต๊อก และปุ่มขายด่วน",
    button: "ดาวน์โหลด CSV"
  },
  {
    href: "/api/backup?type=sales",
    title: "ส่งออกยอดขาย",
    description: "ดาวน์โหลด CSV ประวัติยอดขาย ต้นทุน กำไร วิธีชำระเงิน และจำนวนสินค้า",
    button: "ดาวน์โหลด CSV"
  },
  {
    href: "/api/backup?type=stock",
    title: "ส่งออกสต๊อก",
    description: "ดาวน์โหลด CSV ประวัติ stock movement ทั้งรับเข้า ปรับยอด และขายออก",
    button: "ดาวน์โหลด CSV"
  }
];

export default function BackupPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">สำรองข้อมูล</h1>
        <p className="mt-2 text-lg font-bold text-slate-500">ส่งออกข้อมูลร้านเป็นไฟล์สำรอง ใช้สำหรับเก็บรักษาและตรวจสอบย้อนหลัง</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {exports.map((item) => (
          <div key={item.href} className="card p-5">
            <h2 className="text-2xl font-black text-slate-900">{item.title}</h2>
            <p className="mt-2 min-h-14 font-bold text-slate-600">{item.description}</p>
            <a className="btn btn-primary mt-5 w-full" href={item.href}>
              {item.button}
            </a>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h2 className="text-2xl font-black text-slate-900">สำรองข้อมูลในเครื่อง</h2>
        <p className="mt-2 font-bold text-slate-600">ดาวน์โหลดข้อมูล IndexedDB ในเครื่อง เช่น local sales, sale items, stock movements, product cache และ sync queue</p>
        <div className="mt-5 max-w-sm">
          <LocalBackupButton />
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 font-bold text-amber-900">
        หน้านี้เป็นการส่งออกข้อมูลเท่านั้น ยังไม่มีการนำเข้าหรือกู้คืนข้อมูล จึงไม่กระทบฐานข้อมูลเดิม
      </div>
    </section>
  );
}
