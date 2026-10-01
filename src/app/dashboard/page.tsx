import { AuthGate } from "@/components/auth-gate";
import { AppShell,Page } from "@/components/app-shell";
import { DashboardHome } from "@/components/dashboard-home";
export default function Dashboard(){return <AuthGate><AppShell><Page title="Trang chủ" subtitle="Mọi thứ bạn cần để biến video thô thành video review hoàn chỉnh."><DashboardHome/></Page></AppShell></AuthGate>}
