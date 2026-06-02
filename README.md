# MiniMart POS

ระบบขายหน้าร้าน MVP สำหรับร้านมินิมาร์ทหรือร้านสะดวกซื้อขนาดเล็ก รองรับการขายด้วยบาร์โค้ด ตะกร้าสินค้า รับเงินสด/รับโอน ตัดสต๊อก บันทึก stock movement ประวัติการขาย และรายงานวันนี้

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Neon PostgreSQL
- Prisma ORM
- PWA-ready manifest
- UI ภาษาไทย และสกุลเงินบาท

## การติดตั้ง

1. ติดตั้ง dependencies

```bash
npm install
```

2. สร้างไฟล์ `.env` จาก `.env.example`

```bash
cp .env.example .env
```

บน Windows PowerShell ใช้คำสั่งนี้ได้เช่นกัน:

```powershell
Copy-Item .env.example .env
```

3. สร้างฐานข้อมูล Neon PostgreSQL แล้วคัดลอก connection string มาใส่ใน `.env`

```env
DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-your-project-id.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&schema=public"
PROMPTPAY_ID=""
```

ให้ใช้ connection string ของ Neon project จริงแทนค่าตัวอย่างด้านบน โดยคง `sslmode=require` ไว้ และไม่ต้องเพิ่ม `DIRECT_URL` สำหรับ MVP นี้
ถ้าต้องการแสดง QR พร้อมเพย์บนหน้าโอนเงิน ให้ใส่เลขพร้อมเพย์ของร้านใน `PROMPTPAY_ID` เช่น เบอร์มือถือหรือเลขประจำตัวผู้เสียภาษีของร้าน

4. สร้างตารางด้วย Prisma migration

```bash
npx prisma migrate dev
```

5. เพิ่มข้อมูลตัวอย่าง

```bash
npm run prisma:seed
```

6. รันระบบ

```bash
npm run dev
```

เปิดใช้งานที่ [http://localhost:3000](http://localhost:3000)

## หน้าหลัก

- `/` รายงานวันนี้: ยอดขายวันนี้ จำนวนบิลวันนี้ กำไรขั้นต้นวันนี้ จำนวนสินค้าใกล้หมด และรายการขายล่าสุด
- `/pos` ขายสินค้า: สแกนบาร์โค้ด/ค้นหาชื่อสินค้า เพิ่มลงตะกร้า รับเงินสดหรือรับโอน และบันทึกการขาย
- `/products` สินค้า: เพิ่ม แก้ไข ค้นหา กรองหมวดหมู่ ปิดใช้งาน และไฮไลต์สินค้าใกล้หมด
- `/categories` หมวดหมู่: เพิ่ม แก้ไข และลบหมวดหมู่เมื่อไม่มีสินค้าใช้งาน
- `/stock` สต๊อก: รับสินค้าเข้า ปรับยอด และดูประวัติ stock movement
- `/sales` ประวัติการขาย: ดูบิล ยอดรวม วิธีชำระเงิน กำไร และรายละเอียดสินค้าในบิล

## ข้อมูลตัวอย่าง

Seed data มีสินค้าทดสอบ เช่น โค้ก 500ml, น้ำเปล่า 600ml, เลย์, มาม่า, นมกล่อง และกาแฟกระป๋อง พร้อมบาร์โค้ดตัวอย่าง `8850001000011` ถึง `8850001000066`

## หมายเหตุ

- MVP นี้ยังไม่รวมโปรโมชั่น สมาชิก บัญชี เดลิเวอรี หลายสาขา e-commerce หรือระบบ login จริง
- ห้าม commit `.env` หรือ secret ใด ๆ
- เลขที่ใบเสร็จสร้างในรูปแบบ `POS-YYYYMMDD-0001`
- Sale completion ใช้ database transaction และมี database check constraints เพื่อกันข้อมูลผิด เช่น stock ติดลบหรือ quantity ไม่ถูกต้อง
- `PROMPTPAY_ID` เป็นค่า optional ถ้าไม่ตั้งค่า ระบบจะแสดงข้อความ “ยังไม่ได้ตั้งค่าเลขพร้อมเพย์” แทน QR

## วิธีสร้าง Neon Database

1. สมัครหรือเข้าสู่ระบบ Neon ที่ [neon.tech](https://neon.tech)
2. สร้าง Project ใหม่
3. เลือก region ใกล้ผู้ใช้งาน เช่น Singapore หรือ region ที่ Neon แนะนำ
4. เปิดหน้า Connection details ของ project
5. คัดลอก PostgreSQL connection string
6. วาง connection string ลงในไฟล์ `.env` ที่ตัวแปร `DATABASE_URL`
7. รัน migration และ seed data ด้วยคำสั่งในหัวข้อการติดตั้ง
