"use client";

import { useEffect, useState } from "react";

type Category = { id: string; name: string; _count?: { products: number } };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    setCategories(await fetch("/api/categories").then((res) => res.json()));
  }

  useEffect(() => {
    load();
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch(editing ? `/api/categories/${editing.id}` : "/api/categories", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    if (!res.ok) return setMessage("บันทึกหมวดหมู่ไม่สำเร็จ");
    setName("");
    setEditing(null);
    setMessage("บันทึกหมวดหมู่แล้ว");
    await load();
  }

  async function remove(category: Category) {
    const res = await fetch(`/api/categories/${category.id}`, { method: "DELETE" });
    const data = await res.json();
    setMessage(res.ok ? "ลบหมวดหมู่แล้ว" : data.error);
    await load();
  }

  return (
    <section className="space-y-5">
      <div><h1 className="text-2xl font-black">หมวดหมู่</h1><p className="text-slate-500">จัดหมวดหมู่สินค้าแบบง่าย</p></div>
      {message && <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 font-bold">{message}</div>}
      <form onSubmit={save} className="card flex flex-col gap-3 p-4 md:flex-row">
        <input className="field" placeholder="ชื่อหมวดหมู่" value={name} onChange={(e) => setName(e.target.value)} required />
        <button className="btn btn-primary md:w-48" type="submit">{editing ? "บันทึก" : "เพิ่มหมวดหมู่"}</button>
      </form>
      <div className="card overflow-hidden">
        {categories.map((category) => (
          <div key={category.id} className="flex items-center justify-between border-t border-slate-100 px-4 py-3 first:border-t-0">
            <div><div className="font-black">{category.name}</div><div className="text-sm text-slate-500">สินค้า {category._count?.products ?? 0} รายการ</div></div>
            <div className="flex gap-2">
              <button className="btn btn-light" onClick={() => { setEditing(category); setName(category.name); }} type="button">แก้ไข</button>
              <button className="btn btn-danger" onClick={() => remove(category)} type="button">ลบ</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
