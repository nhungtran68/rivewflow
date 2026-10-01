import { AuthGate } from "@/components/auth-gate";
import { AppShell,Page } from "@/components/app-shell";
import { StylesManager } from "@/components/styles-manager";
export default function StylesPage(){return <AuthGate><AppShell><Page title="Phong cách của tôi" subtitle="Dùng 8 phong cách mặc định hoặc tự tạo prompt riêng."><StylesManager/></Page></AppShell></AuthGate>}
