import Link from "next/link";
import { Plus } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { AppShell, Page } from "@/components/app-shell";
import { ProjectsList } from "@/components/projects-list";
export default function ProjectsPage(){return <AuthGate><AppShell><Page title="Dự án của tôi" subtitle="Theo dõi toàn bộ tiến trình từ video gốc đến bản render cuối." action={<Link href="/create" className="btn-primary hidden sm:inline-flex"><Plus size={18}/>Tạo video</Link>}><ProjectsList/></Page></AppShell></AuthGate>}
