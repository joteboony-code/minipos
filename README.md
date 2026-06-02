# MiniMart POS

ระบบขายหน้าร้าน MVP สำหรับร้านมินิมาร์ทขนาดเล็ก รองรับภาษาไทย สกุลเงินบาท Neon PostgreSQL และ Prisma

## ความสามารถหลัก

- ขายสินค้าด้วยบาร์โค้ดและปุ่มขายด่วน
- รับเงินสด/รับโอน พร้อมคำนวณเงินทอนและ QR พร้อมเพย์
- ตัดสต๊อกและบันทึก StockMovement ใน transaction
- ประวัติการขาย ใบเสร็จ และพิมพ์ผ่าน browser print
- ส่งออก CSV จากประวัติการขาย
- จัดการสินค้า หมวดหมู่ และสต๊อก
- Dashboard รายงานวันนี้
- Login ด้วย PIN แบบ OWNER/STAFF
- หน้า Reports และ Backup สำหรับ OWNER

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma ORM
- Neon PostgreSQL
- Vercel

## Environment Variables

สร้างไฟล์ `.env` จาก `.env.example`

```powershell
Copy-Item .env.example .env
```

ตั้งค่าตัวแปรเหล่านี้:

```env
DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-your-project-id.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&schema=public"
PROMPTPAY_ID=""
OWNER_PIN=""
STAFF_PIN=""
AUTH_SECRET=""
```

- `DATABASE_URL`: connection string จาก Neon PostgreSQL
- `PROMPTPAY_ID`: เลขพร้อมเพย์ของร้าน เว้นว่างได้
- `OWNER_PIN`: PIN สำหรับเจ้าของร้าน
- `STAFF_PIN`: PIN สำหรับพนักงานขาย
- `AUTH_SECRET`: ค่าลับสำหรับ sign cookie ควรเป็นข้อความสุ่มยาว ๆ และห้าม commit

อย่าใส่ค่า secret จริงใน `.env.example` และอย่า commit ไฟล์ `.env`

## วิธีรันในเครื่อง

```bash
npm install
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

เปิดใช้งานที่ [http://localhost:3000](http://localhost:3000)

## วิธีตั้งค่า Neon

1. เข้า [neon.tech](https://neon.tech)
2. สร้าง Project ใหม่
3. เลือก region ที่ใกล้ผู้ใช้ เช่น Singapore ถ้ามีให้เลือก
4. เปิดหน้า Connection details
5. คัดลอก PostgreSQL connection string
6. วางใน `.env` หรือ Vercel Environment Variables ที่ `DATABASE_URL`
7. คง `sslmode=require` ไว้

## วิธีตั้งค่า Vercel

ใน Vercel Project Settings > Environment Variables ให้เพิ่ม:

- `DATABASE_URL`
- `PROMPTPAY_ID`
- `OWNER_PIN`
- `STAFF_PIN`
- `AUTH_SECRET`

หลังเพิ่มหรือแก้ env ให้ redeploy โปรเจกต์

## Login และสิทธิ์ผู้ใช้

หน้า `/login` ใช้ PIN จาก env เท่านั้น ไม่มีตารางผู้ใช้ในฐานข้อมูล

OWNER เข้าถึงได้ทุกหน้า:

- Dashboard
- POS
- Products
- Categories
- Stock
- Sales
- Reports
- Backup

STAFF เข้าถึงได้เฉพาะ:

- POS
- Sales history/detail สำหรับดูบิลหรือพิมพ์ซ้ำ
- PromptPay QR
- Logout

STAFF ไม่สามารถเข้าหน้าจัดการสินค้า หมวดหมู่ สต๊อก Dashboard รายงานกำไร หรือ Backup ได้ และ API owner-only จะตอบกลับว่า `ไม่มีสิทธิ์เข้าถึงหน้านี้`

## Backup / Export

หน้า `/backup` สำหรับ OWNER เท่านั้น

- `ส่งออกข้อมูลทั้งหมด`: JSON รวม categories, products, sales, saleItems, stockMovements
- `ส่งออกสินค้า`: CSV รายการสินค้า
- `ส่งออกยอดขาย`: CSV ยอดขาย ต้นทุน กำไร และวิธีชำระเงิน
- `ส่งออกสต๊อก`: CSV StockMovement

ระบบนี้เป็น export-only ยังไม่มี restore จึงไม่กระทบฐานข้อมูล

## Reports

หน้า `/reports` สำหรับ OWNER เท่านั้น แสดง:

- รายงานวันนี้
- รายงานรายเดือน
- สินค้าขายดี
- กำไรขั้นต้น
- ยอดขายแยกตามวิธีชำระเงิน
- สินค้าใกล้หมด
- สินค้าหมด

การคำนวณวัน/เดือนใช้ขอบเขตเวลา Asia/Bangkok

## คำสั่งตรวจคุณภาพ

```bash
npx prisma validate
npm run lint
npm run build
```

## หมายเหตุ

- ห้าม run destructive database reset บนฐานข้อมูล production
- ถ้าจะ deploy migration บน Neon/Vercel ให้ใช้ `npx prisma migrate deploy`
- ระบบยังไม่รวม promotion, loyalty, staff database, accounting, multi-branch หรือ e-commerce
