import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MiniMart POS",
    short_name: "MiniMart POS",
    description: "ระบบขายหน้าร้านสำหรับร้านมินิมาร์ท",
    start_url: "/pos",
    display: "standalone",
    background_color: "#f7f8fb",
    theme_color: "#0d9488",
    icons: []
  };
}
