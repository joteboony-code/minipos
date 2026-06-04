import { LocalBackupButton } from "./local-backup-button";
import { BackupReminder } from "./backup-reminder";

const exports = [
  {
    href: "/api/backup?type=full",
    title: "เธชเนเธเธญเธญเธเธเนเธญเธกเธนเธฅเธ—เธฑเนเธเธซเธกเธ”",
    description: "เธ”เธฒเธงเธเนเนเธซเธฅเธ” JSON เธฃเธงเธก categories, products, productBatches, sales, saleItems, saleItemBatches, stockMovements, creditPayments เนเธฅเธฐ cashShifts",
    button: "เธ”เธฒเธงเธเนเนเธซเธฅเธ” JSON"
  },
  {
    href: "/api/backup?type=products",
    title: "เธชเนเธเธญเธญเธเธชเธดเธเธเนเธฒ",
    description: "เธ”เธฒเธงเธเนเนเธซเธฅเธ” CSV เธฃเธฒเธขเธเธฒเธฃเธชเธดเธเธเนเธฒ เธฃเธฒเธเธฒเธ—เธธเธ เธฃเธฒเธเธฒเธเธฒเธข เธชเธ•เนเธญเธ เนเธฅเธฐเธเธธเนเธกเธเธฒเธขเธ”เนเธงเธ",
    button: "เธ”เธฒเธงเธเนเนเธซเธฅเธ” CSV"
  },
  {
    href: "/api/backup?type=sales",
    title: "เธชเนเธเธญเธญเธเธขเธญเธ”เธเธฒเธข",
    description: "เธ”เธฒเธงเธเนเนเธซเธฅเธ” CSV เธเธฃเธฐเธงเธฑเธ•เธดเธขเธญเธ”เธเธฒเธข เธ•เนเธเธ—เธธเธ เธเธณเนเธฃ เธงเธดเธเธตเธเธณเธฃเธฐเน€เธเธดเธ เนเธฅเธฐเธเธณเธเธงเธเธชเธดเธเธเนเธฒ",
    button: "เธ”เธฒเธงเธเนเนเธซเธฅเธ” CSV"
  },
  {
    href: "/api/backup?type=stock",
    title: "เธชเนเธเธญเธญเธเธชเธ•เนเธญเธ",
    description: "เธ”เธฒเธงเธเนเนเธซเธฅเธ” CSV เธเธฃเธฐเธงเธฑเธ•เธด stock movement เธ—เธฑเนเธเธฃเธฑเธเน€เธเนเธฒ เธเธฃเธฑเธเธขเธญเธ” เนเธฅเธฐเธเธฒเธขเธญเธญเธ",
    button: "เธ”เธฒเธงเธเนเนเธซเธฅเธ” CSV"
  },
  {
    href: "/api/backup?type=returns",
    title: "ส่งออกข้อมูลคืนสินค้า",
    description: "ดาวน์โหลด CSV รายการคืนสินค้า เลขที่บิล จำนวนคืน ยอดคืน และเหตุผล",
    button: "ดาวน์โหลด CSV"
  }
];

export default function BackupPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">เธชเธณเธฃเธญเธเธเนเธญเธกเธนเธฅ</h1>
        <p className="mt-2 text-lg font-bold text-slate-500">เธชเนเธเธญเธญเธเธเนเธญเธกเธนเธฅเธฃเนเธฒเธเน€เธเนเธเนเธเธฅเนเธชเธณเธฃเธญเธ เนเธเนเธชเธณเธซเธฃเธฑเธเน€เธเนเธเธฃเธฑเธเธฉเธฒเนเธฅเธฐเธ•เธฃเธงเธเธชเธญเธเธขเนเธญเธเธซเธฅเธฑเธ</p>
      </div>

      <BackupReminder />

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
        <h2 className="text-2xl font-black text-slate-900">เธชเธณเธฃเธญเธเธเนเธญเธกเธนเธฅเนเธเน€เธเธฃเธทเนเธญเธ</h2>
        <p className="mt-2 font-bold text-slate-600">เธ”เธฒเธงเธเนเนเธซเธฅเธ”เธเนเธญเธกเธนเธฅ IndexedDB เนเธเน€เธเธฃเธทเนเธญเธ เน€เธเนเธ local sales, sale items, stock movements, product cache เนเธฅเธฐ sync queue</p>
        <div className="mt-5 max-w-sm">
          <LocalBackupButton />
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 font-bold text-amber-900">
        เธซเธเนเธฒเธเธตเนเน€เธเนเธเธเธฒเธฃเธชเนเธเธญเธญเธเธเนเธญเธกเธนเธฅเน€เธ—เนเธฒเธเธฑเนเธ เธขเธฑเธเนเธกเนเธกเธตเธเธฒเธฃเธเธณเน€เธเนเธฒเธซเธฃเธทเธญเธเธนเนเธเธทเธเธเนเธญเธกเธนเธฅ เธเธถเธเนเธกเนเธเธฃเธฐเธ—เธเธเธฒเธเธเนเธญเธกเธนเธฅเน€เธ”เธดเธก
      </div>
    </section>
  );
}

