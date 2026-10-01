import { AuthGate } from "@/components/auth-gate";
import { AppShell, Page } from "@/components/app-shell";
import { CreateWizard } from "@/components/create-wizard";
export default function CreatePage(){return <AuthGate><AppShell><Page title="Tạo video mới" subtitle="Quay sản phẩm → AI hiểu cảnh → viết lời → tạo giọng → render MP4."><CreateWizard/></Page></AppShell></AuthGate>}
