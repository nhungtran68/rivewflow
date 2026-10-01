import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const execFileAsync = promisify(execFile);
const ffmpeg = process.env.FFMPEG_BIN || "ffmpeg";
const ffprobe = process.env.FFPROBE_BIN || "ffprobe";

export type Probe = {
  format: { format_name?: string; duration?: string; start_time?: string };
  streams: Array<Record<string, unknown>>;
};

export async function probeMedia(file: string): Promise<Probe> {
  const { stdout } = await execFileAsync(ffprobe, ["-v","error","-print_format","json","-show_format","-show_streams",file], { maxBuffer: 8 * 1024 * 1024 });
  return JSON.parse(stdout) as Probe;
}

export function mediaDuration(probe: Probe) {
  const raw = probe.format?.duration || probe.streams.find((s) => s.codec_type === "video")?.duration || probe.streams.find((s) => s.codec_type === "audio")?.duration;
  return Number(raw || 0);
}

export async function normalizeSource(input: string, output: string) {
  await execFileAsync(ffmpeg, [
    "-y","-fflags","+genpts","-i",input,
    "-map","0:v:0","-an",
    "-vf","setpts=PTS-STARTPTS,fps=30,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
    "-c:v","libx264","-preset","veryfast","-crf","21","-profile:v","high","-level:v","4.1","-pix_fmt","yuv420p",
    "-r","30","-fps_mode","cfr","-movflags","+faststart","-avoid_negative_ts","make_zero",output
  ], { maxBuffer: 8 * 1024 * 1024 });
}

async function detectSceneTimes(file: string): Promise<number[]> {
  try {
    const { stderr } = await execFileAsync(ffmpeg, ["-hide_banner","-i",file,"-vf","select='gt(scene,0.18)',showinfo","-an","-f","null","-"], { maxBuffer: 16 * 1024 * 1024 });
    const times = [...String(stderr || "").matchAll(/pts_time:([0-9.]+)/g)].map((m) => Number(m[1])).filter(Number.isFinite);
    return Array.from(new Set(times.map((t) => Math.round(t * 10) / 10)));
  } catch (error: unknown) {
    const stderr = typeof error === "object" && error && "stderr" in error ? String((error as { stderr?: string }).stderr || "") : "";
    const times = [...stderr.matchAll(/pts_time:([0-9.]+)/g)].map((m) => Number(m[1])).filter(Number.isFinite);
    return Array.from(new Set(times.map((t) => Math.round(t * 10) / 10)));
  }
}

function sampleTimes(duration: number, sceneTimes: number[]) {
  const wanted = Math.max(12, Math.min(24, Math.ceil(duration / 3)));
  const points = new Set<number>();
  for (const t of sceneTimes) if (t > 0.2 && t < duration - 0.2) points.add(t);
  const interval = duration / wanted;
  for (let i = 0; i < wanted; i++) points.add(Math.max(0, Math.min(duration - 0.05, i * interval + interval / 2)));
  return [...points].sort((a,b) => a-b).slice(0, 30);
}

async function averageHash(file: string) {
  const { data } = await sharp(file).resize(16,16,{ fit:"fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  let sum = 0; for (const n of data) sum += n; const avg = sum / data.length;
  return [...data].map((n) => n >= avg ? "1" : "0").join("");
}
function hamming(a: string, b: string) { let d=0; for (let i=0;i<Math.min(a.length,b.length);i++) if (a[i] !== b[i]) d++; return d + Math.abs(a.length-b.length); }

export async function extractRepresentativeFrames(file: string, outputDir: string) {
  await mkdir(outputDir, { recursive: true });
  const duration = mediaDuration(await probeMedia(file));
  const times = sampleTimes(duration, await detectSceneTimes(file));
  const frames: Array<{ id: string; timestamp: number; file: string; hash: string }> = [];
  for (const timestamp of times) {
    const out = path.join(outputDir, `frame-${String(frames.length+1).padStart(2,"0")}.jpg`);
    try {
      await execFileAsync(ffmpeg, ["-y","-ss",String(timestamp),"-i",file,"-frames:v","1","-vf","scale=512:-2","-q:v","3",out], { maxBuffer: 4 * 1024 * 1024 });
      const hash = await averageHash(out);
      if (frames.some((f) => hamming(f.hash, hash) < 18)) continue;
      frames.push({ id: `scene-${frames.length + 1}`, timestamp, file: out, hash });
      if (frames.length >= 24) break;
    } catch { /* skip bad seek point */ }
  }
  if (frames.length < 6) throw new Error("Không trích xuất đủ frame đại diện từ video");
  return frames;
}

function escapeSubtitlePath(file: string) { return file.replace(/\\/g,"/").replace(/:/g,"\\:").replace(/'/g,"\\'"); }

export async function writeSrt(segments: Array<{ start:number; end:number; caption?:string; voice_text?:string }>, file: string) {
  const fmt = (n:number) => {
    const ms = Math.max(0, Math.round(n*1000)); const h=Math.floor(ms/3600000), m=Math.floor(ms%3600000/60000), s=Math.floor(ms%60000/1000), x=ms%1000;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(x).padStart(3,"0")}`;
  };
  const text = segments.map((seg,i) => `${i+1}\n${fmt(seg.start)} --> ${fmt(seg.end)}\n${(seg.caption || seg.voice_text || "").trim()}\n`).join("\n");
  await writeFile(file, text, "utf8");
}

export async function renderSocialVideo(input: { video: string; audio: string; output: string; subtitleFile?: string }) {
  const [vp, ap] = await Promise.all([probeMedia(input.video), probeMedia(input.audio)]);
  const videoDuration = mediaDuration(vp); const audioDuration = mediaDuration(ap);
  if (!videoDuration || !audioDuration) throw new Error("Không đọc được duration video/audio");
  const pad = Math.max(0, audioDuration - videoDuration + 0.08);
  let vf = `setpts=PTS-STARTPTS,fps=30${pad > 0 ? `,tpad=stop_mode=clone:stop_duration=${pad.toFixed(3)}` : ""}`;
  if (input.subtitleFile) vf += `,subtitles='${escapeSubtitlePath(input.subtitleFile)}':force_style='FontSize=18,Alignment=2,MarginV=240,Outline=2,Shadow=0'`;
  await execFileAsync(ffmpeg, [
    "-y","-i",input.video,"-i",input.audio,
    "-filter_complex",`[0:v]${vf}[v]`,
    "-map","[v]","-map","1:a:0","-t",audioDuration.toFixed(3),
    "-c:v","libx264","-preset","medium","-crf","20","-profile:v","high","-level:v","4.1","-pix_fmt","yuv420p","-r","30","-fps_mode","cfr",
    "-c:a","aac","-b:a","192k","-ar","48000","-ac","2",
    "-movflags","+faststart","-avoid_negative_ts","make_zero",input.output
  ], { maxBuffer: 16 * 1024 * 1024 });
  return { expectedDuration: audioDuration };
}

function rateToNumber(v: unknown) {
  const s = String(v || "0/1"); const [a,b] = s.split("/").map(Number); return b ? a/b : Number(s);
}

export async function validateSocialVideo(file: string, expectedDuration?: number) {
  const probe = await probeMedia(file);
  const video = probe.streams.find((s) => s.codec_type === "video") || {};
  const audio = probe.streams.find((s) => s.codec_type === "audio") || {};
  const duration = mediaDuration(probe);
  const errors: string[] = [];
  if (video.codec_name !== "h264") errors.push("video codec is not H.264");
  if (video.pix_fmt !== "yuv420p") errors.push("pixel format is not yuv420p");
  if (Number(video.width) !== 1080 || Number(video.height) !== 1920) errors.push("resolution is not 1080x1920");
  if (Math.abs(rateToNumber(video.avg_frame_rate) - 30) > 0.05) errors.push("average frame rate is not 30 FPS");
  if (audio.codec_name !== "aac") errors.push("audio codec is not AAC");
  if (Number(audio.sample_rate) !== 48000) errors.push("audio sample rate is not 48kHz");
  if (Number(audio.channels) !== 2) errors.push("audio is not stereo");
  if (!duration || duration < 0.1) errors.push("duration metadata is invalid");
  if (Math.abs(Number(probe.format.start_time || 0)) > 0.15) errors.push("start_time is not near zero");
  if (expectedDuration && Math.abs(duration - expectedDuration) > 0.65) errors.push(`duration mismatch: expected ${expectedDuration.toFixed(2)} got ${duration.toFixed(2)}`);
  return { ok: errors.length === 0, errors, duration, probe };
}

export async function repairSocialVideo(input: { source: string; output: string; expectedDuration: number }) {
  await execFileAsync(ffmpeg, [
    "-y","-fflags","+genpts","-i",input.source,"-t",input.expectedDuration.toFixed(3),
    "-map","0:v:0","-map","0:a:0","-vf","setpts=PTS-STARTPTS,fps=30,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
    "-c:v","libx264","-preset","medium","-crf","20","-profile:v","high","-level:v","4.1","-pix_fmt","yuv420p","-r","30","-fps_mode","cfr",
    "-c:a","aac","-b:a","192k","-ar","48000","-ac","2","-movflags","+faststart","-avoid_negative_ts","make_zero",input.output
  ], { maxBuffer: 16 * 1024 * 1024 });
}

export async function readFileBuffer(file: string) { return readFile(file); }
