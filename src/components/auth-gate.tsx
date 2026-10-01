"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter(); const pathname = usePathname(); const [ready,setReady]=useState(false);
  useEffect(()=>{ let active=true; fetch("/api/auth/me",{cache:"no-store"}).then(r=>{if(!r.ok){router.replace(`/login?next=${encodeURIComponent(pathname)}`);return;} if(active)setReady(true)}).catch(()=>router.replace("/login")); return()=>{active=false}; },[router,pathname]);
  if(!ready) return <div className="min-h-screen grid place-items-center"><div className="text-center"><div className="mx-auto mb-3 h-10 w-10 rounded-full border-4 border-orange-100 border-t-orange-500 animate-spin"/><p className="text-sm text-slate-500">Đang mở studio…</p></div></div>;
  return <>{children}</>;
}
