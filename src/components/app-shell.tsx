"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CircleUserRound, FolderKanban, House, Mic2, Plus, Sparkles, UserRound, WandSparkles } from "lucide-react";

const nav = [
  { href:"/dashboard", label:"Trang chủ", icon:House },
  { href:"/projects", label:"Dự án", icon:FolderKanban },
  { href:"/create", label:"Tạo video", icon:Plus, primary:true },
  { href:"/voices", label:"Giọng nói", icon:Mic2 },
  { href:"/styles", label:"Phong cách", icon:WandSparkles },
  { href:"/account", label:"Tài khoản", icon:UserRound }
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname=usePathname(); const router=useRouter();
  async function logout(){await fetch("/api/auth/logout",{method:"POST"});router.replace("/login")}
  return <div className="min-h-screen lg:flex">
    <aside className="hidden lg:flex w-64 shrink-0 bg-[#121a2b] text-white min-h-screen p-5 flex-col sticky top-0 h-screen">
      <Link href="/projects" className="flex items-center gap-3 px-2 py-3"><div className="h-10 w-10 rounded-xl bg-orange-500 grid place-items-center"><Sparkles size={20}/></div><div><b className="text-lg">ReviewFlow</b><div className="text-[11px] text-slate-400">AI VIDEO STUDIO</div></div></Link>
      <nav className="mt-8 space-y-2">{nav.map(item=>{const Icon=item.icon;const active=pathname.startsWith(item.href);return <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${item.primary?"bg-orange-500 text-white hover:bg-orange-600":active?"bg-white/10 text-white":"text-slate-400 hover:bg-white/5 hover:text-white"}`}><Icon size={18}/>{item.label}</Link>})}</nav>
      <button onClick={logout} className="mt-auto flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-400 hover:text-white hover:bg-white/5"><CircleUserRound size={18}/>Đăng xuất</button>
    </aside>
    <main className="min-w-0 flex-1 pb-24 lg:pb-8">{children}</main>
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 glass border-t border-slate-200 safe-bottom px-2 pt-2"><div className="grid grid-cols-6 items-end">{nav.map(item=>{const Icon=item.icon;const active=pathname.startsWith(item.href);return <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 text-[10px] font-bold ${active?"text-orange-600":"text-slate-500"}`}>{item.primary?<span className="-mt-7 grid h-14 w-14 place-items-center rounded-full bg-orange-500 text-white shadow-xl shadow-orange-200"><Icon size={24}/></span>:<Icon size={21}/>}<span>{item.label}</span></Link>})}</div></nav>
  </div>
}

export function Page({ children, title, subtitle, action }: {children:React.ReactNode;title:string;subtitle?:string;action?:React.ReactNode}){
  return <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8"><div className="mb-6 flex items-start justify-between gap-4"><div><h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">{title}</h1>{subtitle&&<p className="mt-1 text-sm sm:text-base text-slate-500">{subtitle}</p>}</div>{action}</div>{children}</div>
}
