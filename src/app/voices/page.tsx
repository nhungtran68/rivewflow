import { AuthGate } from "@/components/auth-gate";
import { AppShell,Page } from "@/components/app-shell";
import { VoicesManager } from "@/components/voices-manager";
export default function VoicesPage(){return <AuthGate><AppShell><Page title="Giọng nói" subtitle="Quản lý giọng VBee và clone chính giọng của bạn qua ElevenLabs."><VoicesManager/></Page></AppShell></AuthGate>}
