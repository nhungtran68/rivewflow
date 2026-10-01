import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "ReviewFlow AI",
  description: "Tạo video review sản phẩm bằng AI — quay, phân tích, viết kịch bản, tạo giọng và render video chuẩn mạng xã hội.",
  manifest: "/manifest.webmanifest"
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#121a2b" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body><PwaRegister />{children}</body></html>;
}
