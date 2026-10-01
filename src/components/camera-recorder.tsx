"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, CircleStop, RotateCcw, Upload, Video } from "lucide-react";

export function CameraRecorder({ onVideo }: { onVideo: (blob: Blob, name: string) => void }) {
  const videoRef=useRef<HTMLVideoElement>(null); const streamRef=useRef<MediaStream|null>(null); const recorderRef=useRef<MediaRecorder|null>(null); const chunks=useRef<Blob[]>([]);
  const [recording,setRecording]=useState(false); const [preview,setPreview]=useState<string>(""); const [error,setError]=useState(""); const [blob,setBlob]=useState<Blob|null>(null);
  useEffect(()=>()=>{streamRef.current?.getTracks().forEach(t=>t.stop());if(preview)URL.revokeObjectURL(preview)},[preview]);
  async function openCamera(){setError("");try{streamRef.current?.getTracks().forEach(t=>t.stop());const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1080},height:{ideal:1920},aspectRatio:{ideal:9/16}},audio:true});streamRef.current=stream;if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}}catch(e){setError("Không mở được camera. Hãy cấp quyền camera/micro và thử lại.")}}
  function start(){if(!streamRef.current)return;chunks.current=[];const candidates=["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/mp4","video/webm"];const mime=candidates.find(x=>MediaRecorder.isTypeSupported(x));const rec=new MediaRecorder(streamRef.current,mime?{mimeType:mime}:undefined);rec.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data)};rec.onstop=()=>{const b=new Blob(chunks.current,{type:rec.mimeType||"video/webm"});setBlob(b);const url=URL.createObjectURL(b);setPreview(url);streamRef.current?.getTracks().forEach(t=>t.stop());if(videoRef.current)videoRef.current.srcObject=null};recorderRef.current=rec;rec.start(800);setRecording(true)}
  function stop(){recorderRef.current?.stop();setRecording(false)}
  function reset(){if(preview)URL.revokeObjectURL(preview);setPreview("");setBlob(null);openCamera()}
  function pick(file?:File){if(!file)return;if(!file.type.startsWith("video/")){setError("Vui lòng chọn file video.");return}setBlob(file);setPreview(URL.createObjectURL(file));onVideo(file,file.name)}
  return <div className="space-y-4">
    <div className="relative mx-auto aspect-[9/16] max-h-[64vh] w-full max-w-[360px] overflow-hidden rounded-[1.7rem] bg-[#0e1421] shadow-2xl shadow-slate-300">
      {preview?<video src={preview} controls playsInline className="h-full w-full object-contain"/>:<video ref={videoRef} muted playsInline className="h-full w-full object-cover"/>}
      {!preview&&!streamRef.current&&<div className="absolute inset-0 grid place-items-center text-center p-8 text-white"><div><div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-white/10"><Camera/></div><b>Mở camera để quay sản phẩm</b><p className="mt-2 text-xs text-slate-400">Khung dọc 9:16 · ưu tiên camera sau</p></div></div>}
      {recording&&<div className="absolute top-4 left-4 rounded-full bg-red-500 px-3 py-1 text-xs font-black text-white">● REC</div>}
    </div>
    {error&&<div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-center">
      {!streamRef.current&&!preview&&<button type="button" onClick={openCamera} className="btn-primary"><Camera size={18}/>Mở camera</button>}
      {streamRef.current&&!recording&&!preview&&<button type="button" onClick={start} className="btn-primary"><Video size={18}/>Bắt đầu quay</button>}
      {recording&&<button type="button" onClick={stop} className="btn-primary bg-red-500 hover:bg-red-600"><CircleStop size={18}/>Dừng quay</button>}
      {preview&&<button type="button" onClick={reset} className="btn-secondary"><RotateCcw size={18}/>Quay lại</button>}
      {preview&&blob&&<button type="button" onClick={()=>onVideo(blob,`camera-${Date.now()}.${blob.type.includes("mp4")?"mp4":"webm"}`)} className="btn-primary">Sử dụng video</button>}
      <label className="btn-secondary cursor-pointer"><Upload size={18}/>Tải video<input type="file" accept="video/*" className="hidden" onChange={e=>pick(e.target.files?.[0])}/></label>
    </div>
  </div>
}
