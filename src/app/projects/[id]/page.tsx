import { AuthGate } from "@/components/auth-gate";
import { AppShell, Page } from "@/components/app-shell";
import { ProjectWorkspace } from "@/components/project-workspace";
export default async function ProjectPage({params}:{params:Promise<{id:string}>}){const{id}=await params;return <AuthGate><AppShell><Page title="Studio dự án" subtitle="Theo dõi từng bước và chỉ render khi tài nguyên đã sẵn sàng."><ProjectWorkspace id={id}/></Page></AppShell></AuthGate>}
