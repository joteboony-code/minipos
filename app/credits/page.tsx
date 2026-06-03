import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreditsClient, type CreditSaleRow } from "./credits-client";

export default async function CreditsPage() {
  await requireRole(["OWNER"]);
  const sales = await prisma.sale.findMany({
    where: { paymentMethod: "CREDIT" },
    include: { creditPayments: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  const rows: CreditSaleRow[] = sales.map((sale) => {
    const due = Number(sale.creditDueAmount ?? sale.totalAmount);
    const paid = Number(sale.creditPaidAmount ?? 0);
    return {
      id: sale.id,
      receiptNo: sale.receiptNo,
      createdAt: sale.createdAt.toISOString(),
      customerName: sale.creditCustomerName ?? "-",
      phone: sale.creditCustomerPhone ?? "-",
      due,
      paid,
      remaining: Math.max(due - paid, 0),
      status: sale.creditStatus ?? "UNPAID",
      payments: sale.creditPayments.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
        note: payment.note,
        createdAt: payment.createdAt.toISOString()
      }))
    };
  });

  return <CreditsClient initialRows={rows} />;
}
