"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router=useRouter(); const search=useSearchParams(); const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setLoading(true);setError("");const fd=new FormData(e.currentTarget);const body:any={email:fd.get("email"),password:fd.get("password")};if(mode==="register")body.name=fd.get("name");try{const r=await fetch(`/api/auth/${mode}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw new Error(j.error||"Không thể đăng nhập");router.replace(search.get("next")||"/projects");}catch(err){setError(err instanceof Error?err.message:"Có lỗi xảy ra")}finally{setLoading(false)}}
  return <div className="min-h-screen grid lg:grid-cols-2">
    <div className="hidden lg:flex bg-[#121a2b] text-white p-12 flex-col justify-between"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-orange-500"><Sparkles/></div><b className="text-xl">ReviewFlow AI</b></div><div className="max-w-lg"><p className="text-sm font-bold uppercase tracking-[.2em] text-orange-400">AI Video Studio</p><h1 className="mt-4 text-5xl font-black leading-tight">Từ video thô thành video review sẵn sàng đăng.</h1><p className="mt-5 text-lg text-slate-300">Quay sản phẩm, để AI hiểu cảnh quay, viết lời, tạo giọng và render MP4 chuẩn mạng xã hội.</p></div><p className="text-sm text-slate-500">H.264 · AAC · CFR 30 FPS · Faststart</p></div>
    <div className="grid place-items-center p-5 sm:p-10"><form onSubmit={submit} className="w-full max-w-md card p-6 sm:p-8"><div className="lg:hidden flex items-center gap-2 mb-7"><div className="grid h-9 w-9 place-items-center rounded-xl bg-orange-500 text-white"><Sparkles size={18}/></div><b>ReviewFlow AI</b></div><h2 className="text-2xl font-black">{mode==="login"?"Đăng nhập":"Tạo tài khoản"}</h2><p className="mt-1 text-sm text-slate-500">{mode==="login"?"Tiếp tục dự án video của bạn.":"Bắt đầu tạo video review bằng AI."}</p>
      <div className="mt-6 space-y-4">{mode==="register"&&<label><span className="label">Tên hiển thị</span><input name="name" required minLength={2} className="input" placeholder="Ví dụ: Quỳnh Hoa"/></label>}<label><span className="label">Email</span><input name="email" type="email" required className="input" placeholder="ban@example.com"/></label><label><span className="label">Mật khẩu</span><input name="password" type="password" required minLength={8} className="input" placeholder="Tối thiểu 8 ký tự"/></label></div>
      {error&&<div className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
      <button disabled={loading} className="btn-primary mt-6 w-full">{loading?"Đang xử lý…":mode==="login"?"Đăng nhập":"Tạo tài khoản"}</button>
      <p className="mt-5 text-center text-sm text-slate-500">{mode==="login"?"Chưa có tài khoản? ":"Đã có tài khoản? "}<Link className="font-bold text-orange-600" href={mode==="login"?"/register":"/login"}>{mode==="login"?"Đăng ký":"Đăng nhập"}</Link></p>
    </form></div>
  </div>
}
