import { AuthGate } from "@/components/auth-gate";
import { AppShell,Page } from "@/components/app-shell";
import { AccountCard } from "@/components/account-card";
export default function AccountPage(){return <AuthGate><AppShell><Page title="Tài khoản" subtitle="Thông tin người dùng và nguyên tắc bảo mật của workspace."><AccountCard/></Page></AppShell></AuthGate>}
