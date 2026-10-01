import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { db } from "@/lib/db";
import { mustEnv, appUrl } from "@/lib/config";
import { downloadToFile, uploadFile, uploadBuffer } from "@/lib/storage";
import { analyzeVideoFrames, generateAngles, generateScript, rewriteScriptToDuration, type ContentAngle } from "@/lib/ai/deepseek";
import { DEFAULT_STYLES, type VideoAnalysis } from "@/lib/types";
import { ElevenLabsProvider } from "@/lib/tts/elevenlabs";
import { ttsProvider } from "@/lib/tts";
import { stableHash } from "@/lib/hash";
import { enqueue } from "@/lib/queue";
import { segmentsFromText } from "@/lib/script-segments";
import { extractRepresentativeFrames, mediaDuration, normalizeSource, probeMedia, renderSocialVideo, repairSocialVideo, validateSocialVideo, writeSrt } from "./video";

const connection = new IORedis(mustEnv("REDIS_URL"), { maxRetriesPerRequest: null });
const concurrency = Number(process.env.WORKER_CONCURRENCY || 2);

async function tempDir(prefix: string) {
  const base = process.env.TEMP_DIR || os.tmpdir();
  await mkdir(base, { recursive: true });
  return mkdtemp(path.join(base, `${prefix}-`));
}

async function updateProject(projectId: string, status: string, progress: number, message: string) {
  await db()`UPDATE projects SET status=${status},progress=${progress},status_message=${message},updated_at=now() WHERE id=${projectId}`;
}

async function withLog<T>(job: Job, step: string, fn: () => Promise<T>, provider?: string): Promise<T> {
  const started = Date.now(); const sql = db();
  const [row] = await sql`INSERT INTO job_logs (job_id,project_id,user_id,provider,step,status) VALUES (${String(job.id)},${job.data.projectId || null},${job.data.userId || null},${provider || null},${step},'RUNNING') RETURNING id`;
  try {
    const result = await fn();
    await sql`UPDATE job_logs SET status='COMPLETED',finished_at=now(),duration_ms=${Date.now()-started} WHERE id=${row.id}`;
    return result;
  } catch (error) {
    const code = error instanceof Error ? error.name : "WORKER_ERROR";
    const msg = error instanceof Error ? error.message : String(error);
    await sql`UPDATE job_logs SET status='FAILED',finished_at=now(),duration_ms=${Date.now()-started},error_code=${code},message=${msg.slice(0,1000)} WHERE id=${row.id}`;
    throw error;
  }
}

async function analyzeJob(job: Job) {
  return withLog(job, "analyze-video", async () => {
    const sql = db(); const { projectId, userId } = job.data;
    const [project] = await sql`SELECT * FROM projects WHERE id=${projectId} AND user_id=${userId}`;
    if (!project?.sourceVideoKey) throw new Error("Project source video is missing");
    const dir = await tempDir(`analyze-${projectId}`);
    try {
      const source = path.join(dir, "source"); const normalized = path.join(dir, "normalized.mp4");
      await updateProject(projectId, "ANALYZING", 22, "Đang chuẩn hóa video");
      await downloadToFile(project.sourceVideoKey, source);
      await normalizeSource(source, normalized);
      const normalizedProbe = await probeMedia(normalized);
      const normalizedKey = `users/${userId}/projects/${projectId}/source/normalized.mp4`;
      await uploadFile(normalizedKey, normalized, "video/mp4");
      const vstream = normalizedProbe.streams.find((s) => s.codec_type === "video") || {};
      await sql`UPDATE projects SET normalized_video_key=${normalizedKey},progress=30,status_message='Đang lấy các cảnh quan trọng',updated_at=now() WHERE id=${projectId}`;
      await sql`INSERT INTO videos (project_id,storage_key,kind,mime_type,width,height,duration_seconds,codec_name,pix_fmt,frame_rate,time_base,metadata) VALUES (${projectId},${normalizedKey},'NORMALIZED','video/mp4',${Number(vstream.width||0)},${Number(vstream.height||0)},${mediaDuration(normalizedProbe)},${String(vstream.codec_name||'')},${String(vstream.pix_fmt||'')},${String(vstream.avg_frame_rate||'')},${String(vstream.time_base||'')},${JSON.stringify(normalizedProbe)}::jsonb)`;

      const framesDir = path.join(dir, "frames");
      const frames = await extractRepresentativeFrames(normalized, framesDir);
      await sql`DELETE FROM video_frames WHERE project_id=${projectId}`;
      for (const frame of frames) {
        const key = `users/${userId}/projects/${projectId}/frames/${path.basename(frame.file)}`;
        await uploadFile(key, frame.file, "image/jpeg");
        await sql`INSERT INTO video_frames (project_id,scene_id,timestamp_seconds,storage_key,visual_hash) VALUES (${projectId},${frame.id},${frame.timestamp},${key},${frame.hash})`;
      }
      await updateProject(projectId, "ANALYZING", 38, `AI đang phân tích ${frames.length} frame đại diện`);
      const product = { name: project.productName, description: project.description, price: project.price, offer: project.offer, target_customer: project.targetCustomer, highlights: project.highlights, cta: project.cta, forbidden_info: project.forbiddenInfo };
      const analysis = await analyzeVideoFrames({ product, frames });
      await sql`INSERT INTO video_analysis (project_id,product_detected,scenes,visible_features,possible_selling_points,interesting_visual_moments,recommended_hooks,uncertain_information,warnings,raw)
        VALUES (${projectId},${analysis.product_detected},${JSON.stringify(analysis.scenes)}::jsonb,${JSON.stringify(analysis.visible_features)}::jsonb,${JSON.stringify(analysis.possible_selling_points)}::jsonb,${JSON.stringify(analysis.interesting_visual_moments)}::jsonb,${JSON.stringify(analysis.recommended_hooks)}::jsonb,${JSON.stringify(analysis.uncertain_information)}::jsonb,${JSON.stringify(analysis.warnings)}::jsonb,${JSON.stringify(analysis)}::jsonb)
        ON CONFLICT (project_id) DO UPDATE SET product_detected=excluded.product_detected,scenes=excluded.scenes,visible_features=excluded.visible_features,possible_selling_points=excluded.possible_selling_points,interesting_visual_moments=excluded.interesting_visual_moments,recommended_hooks=excluded.recommended_hooks,uncertain_information=excluded.uncertain_information,warnings=excluded.warnings,raw=excluded.raw,updated_at=now()`;

      await updateProject(projectId, "ANALYZING", 44, "Đang đề xuất góc nội dung");
      const angles = await generateAngles(analysis, product);
      await sql`DELETE FROM content_angles WHERE project_id=${projectId}`;
      for (let i=0;i<angles.length;i++) {
        const a = angles[i];
        await sql`INSERT INTO content_angles (project_id,title,hook,insight,product_focus,scene_suggestion,cta,ai_recommended,sort_order) VALUES (${projectId},${a.title},${a.hook},${a.insight},${a.product_focus},${a.scene_suggestion},${a.cta},${Boolean(a.ai_recommended)},${i})`;
      }
      await updateProject(projectId, "ANALYZED", 48, "Phân tích xong — hãy chọn góc nội dung");
    } finally { await rm(dir, { recursive: true, force: true }); }
  }, "DEEPSEEK");
}

async function scriptJob(job: Job) {
  return withLog(job, "generate-script", async () => {
    const sql = db(); const { projectId, userId } = job.data;
    const [project] = await sql`SELECT * FROM projects WHERE id=${projectId} AND user_id=${userId}`;
    const [analysisRow] = await sql`SELECT * FROM video_analysis WHERE project_id=${projectId}`;
    const [angle] = await sql`SELECT * FROM content_angles WHERE id=${project?.selectedAngleId} AND project_id=${projectId}`;
    if (!project || !analysisRow || !angle) throw new Error("Project analysis or selected angle missing");
    const analysis: VideoAnalysis = analysisRow.raw as VideoAnalysis;
    let styleName = "Tùy chỉnh", stylePrompt = "Tự nhiên và phù hợp sản phẩm.";
    const builtIn = DEFAULT_STYLES.find((s) => s.key === project.styleKey);
    if (builtIn) { styleName = builtIn.name; stylePrompt = builtIn.prompt; }
    else {
      const [custom] = await sql`SELECT * FROM custom_styles WHERE id::text=${String(project.styleKey)} AND user_id=${userId}`;
      if (custom) { styleName = custom.name; stylePrompt = custom.prompt; }
    }
    const product = { name: project.productName, description: project.description, price: project.price, offer: project.offer, target_customer: project.targetCustomer, highlights: project.highlights, cta: project.cta, forbidden_info: project.forbiddenInfo };
    const a: ContentAngle = { title: angle.title, hook: angle.hook, insight: angle.insight, product_focus: angle.productFocus, scene_suggestion: angle.sceneSuggestion, cta: angle.cta, ai_recommended: angle.aiRecommended };
    const result = await generateScript({ product, analysis, angle: a, styleName, stylePrompt, targetDuration: project.targetDuration });
    const [v] = await sql`SELECT COALESCE(MAX(version),0) AS max FROM scripts WHERE project_id=${projectId}`;
    await sql`UPDATE scripts SET is_current=false WHERE project_id=${projectId}`;
    await sql`INSERT INTO scripts (project_id,angle_id,style_key,target_duration,script_text,segments,estimated_duration,version,is_current) VALUES (${projectId},${angle.id},${project.styleKey},${project.targetDuration},${result.script_text},${JSON.stringify(result.segments)}::jsonb,${result.estimated_duration},${Number(v.max)+1},true)`;
    await updateProject(projectId, "SCRIPT_READY", 62, "Kịch bản đã sẵn sàng — bạn có thể chỉnh sửa trực tiếp");
  }, "DEEPSEEK");
}

async function cloneVoiceJob(job: Job) {
  return withLog(job, "clone-voice", async () => {
    const { userId, displayName, sampleKeys, removeBackgroundNoise } = job.data as { userId:string; displayName:string; sampleKeys:string[]; removeBackgroundNoise:boolean };
    const dir = await tempDir(`voice-${userId}`);
    try {
      const files: Array<{ name:string; type:string; data:Buffer }> = [];
      for (let i=0;i<sampleKeys.length;i++) {
        const ext = path.extname(sampleKeys[i]) || ".mp3"; const file = path.join(dir, `sample-${i}${ext}`);
        await downloadToFile(sampleKeys[i], file);
        const data = await import("node:fs/promises").then((m) => m.readFile(file));
        const type = ext === ".wav" ? "audio/wav" : ext === ".webm" ? "audio/webm" : "audio/mpeg";
        files.push({ name: path.basename(file), type, data });
      }
      const result = await new ElevenLabsProvider().cloneVoice({ name: displayName, files, removeBackgroundNoise });
      await db()`INSERT INTO voices (user_id,provider,display_name,external_voice_id,status,consent_at) VALUES (${userId},'ELEVENLABS',${displayName},${result.voice_id},'READY',now()) ON CONFLICT (user_id,provider,external_voice_id) DO UPDATE SET display_name=excluded.display_name,status='READY',consent_at=now(),updated_at=now()`;
    } finally { await rm(dir, { recursive: true, force: true }); }
  }, "ELEVENLABS");
}

async function finalizeSyncAudio(project: any, script: any, voice: any, audioRow: any, audio: Buffer, contentType: string, userId: string) {
  const sql = db(); const dir = await tempDir(`audio-${project.id}`);
  try {
    let currentAudio = audio; let currentScript = script; let currentRow = audioRow;
    let file = path.join(dir, "audio.mp3"); await writeFile(file, currentAudio);
    let probe = await probeMedia(file); let duration = mediaDuration(probe);
    const mismatch = Math.abs(duration - Number(project.targetDuration)) / Number(project.targetDuration);
    if (mismatch > 0.20 && Number(currentRow.adjustmentCount || 0) < 1) {
      const direction = duration > Number(project.targetDuration) ? "shorter" : "longer";
      const rewritten = await rewriteScriptToDuration(currentScript.scriptText, Number(project.targetDuration), direction);
      const [v] = await sql`SELECT COALESCE(MAX(version),0) AS max FROM scripts WHERE project_id=${project.id}`;
      await sql`UPDATE scripts SET is_current=false WHERE project_id=${project.id}`;
      const [newScript] = await sql`INSERT INTO scripts (project_id,angle_id,style_key,target_duration,script_text,segments,estimated_duration,version,is_current) VALUES (${project.id},${currentScript.angleId},${currentScript.styleKey},${project.targetDuration},${rewritten},${JSON.stringify(segmentsFromText(rewritten, Number(project.targetDuration)))}::jsonb,${project.targetDuration},${Number(v.max)+1},true) RETURNING *`;
      currentScript = newScript;
      const result = await ttsProvider(voice.provider).synthesize({ text: rewritten, externalVoiceId: voice.externalVoiceId, speed: Number(voice.speed || 1), callbackUrl: `${appUrl()}/api/vbee/callback?secret=${encodeURIComponent(process.env.VBEE_CALLBACK_SECRET || "")}` });
      if (result.mode !== "sync") throw new Error("Unexpected async result during sync regeneration");
      currentAudio = result.audio; await writeFile(file, currentAudio); probe = await probeMedia(file); duration = mediaDuration(probe);
      const newHash = stableHash({ text: rewritten, voiceId: voice.id, speed: voice.speed, provider: voice.provider });
      await sql`UPDATE audio_generations SET status='SUPERSEDED',updated_at=now() WHERE id=${currentRow.id}`;
      const [row] = await sql`INSERT INTO audio_generations (project_id,script_id,voice_id,provider,input_hash,status,adjustment_count) VALUES (${project.id},${newScript.id},${voice.id},${voice.provider},${newHash},'PROCESSING',1) ON CONFLICT (project_id,input_hash) DO UPDATE SET status='PROCESSING',adjustment_count=1,updated_at=now() RETURNING *`;
      currentRow = row;
    }
    const astream = probe.streams.find((s) => s.codec_type === "audio") || {};
    const key = `users/${userId}/projects/${project.id}/audio/${currentRow.id}.mp3`;
    await uploadBuffer(key, currentAudio, contentType || "audio/mpeg");
    await sql`UPDATE audio_generations SET storage_key=${key},duration_seconds=${duration},codec_name=${String(astream.codec_name||'')},sample_rate=${Number(astream.sample_rate||0)},channels=${Number(astream.channels||0)},status='READY',updated_at=now() WHERE id=${currentRow.id}`;
    await updateProject(project.id, "AUDIO_READY", 78, "Giọng nói đã sẵn sàng");
  } finally { await rm(dir, { recursive: true, force: true }); }
}

async function audioJob(job: Job) {
  const providerLabel = "TTS";
  return withLog(job, "generate-audio", async () => {
    const sql = db(); const { projectId, userId, voiceId, inputHash, adjustmentCount = 0 } = job.data;
    const [project] = await sql`SELECT * FROM projects WHERE id=${projectId} AND user_id=${userId}`;
    const [script] = job.data.scriptId
      ? await sql`SELECT * FROM scripts WHERE id=${job.data.scriptId} AND project_id=${projectId} LIMIT 1`
      : await sql`SELECT * FROM scripts WHERE project_id=${projectId} AND is_current=true ORDER BY version DESC LIMIT 1`;
    const [voice] = await sql`SELECT * FROM voices WHERE id=${voiceId} AND user_id=${userId} AND status='READY'`;
    if (!project || !script || !voice) throw new Error("Missing project/script/voice for TTS");
    const [cached] = await sql`SELECT * FROM audio_generations WHERE project_id=${projectId} AND input_hash=${inputHash} AND status='READY' LIMIT 1`;
    if (cached?.storageKey) { await updateProject(projectId, "AUDIO_READY", 78, "Đã dùng lại audio đã tạo trước đó"); return; }
    const [audioRow] = await sql`INSERT INTO audio_generations (project_id,script_id,voice_id,provider,input_hash,status,adjustment_count) VALUES (${projectId},${script.id},${voice.id},${voice.provider},${inputHash},'PROCESSING',${Number(adjustmentCount)}) ON CONFLICT (project_id,input_hash) DO UPDATE SET status='PROCESSING',adjustment_count=GREATEST(audio_generations.adjustment_count,excluded.adjustment_count),updated_at=now() RETURNING *`;
    const callbackUrl = `${appUrl()}/api/vbee/callback?secret=${encodeURIComponent(process.env.VBEE_CALLBACK_SECRET || "")}`;
    const result = await ttsProvider(voice.provider).synthesize({ text: script.scriptText, externalVoiceId: voice.externalVoiceId, speed: Number(voice.speed || 1), callbackUrl, idempotencyKey: inputHash });
    if (result.mode === "async") {
      await sql`UPDATE audio_generations SET provider_request_id=${result.providerRequestId},status='PROCESSING',updated_at=now() WHERE id=${audioRow.id}`;
      await updateProject(projectId, "GENERATING_AUDIO", 72, "VBee đang xử lý giọng nói — hệ thống sẽ nhận callback tự động");
      return;
    }
    await sql`UPDATE audio_generations SET provider_request_id=${result.providerRequestId || null},updated_at=now() WHERE id=${audioRow.id}`;
    await finalizeSyncAudio(project, script, voice, audioRow, result.audio, result.contentType, userId);
  }, providerLabel);
}

async function finalizeVbeeJob(job: Job) {
  return withLog(job, "finalize-vbee-audio", async () => {
    const sql = db(); const { audioId, projectId, audioUrl } = job.data;
    const [audioRow] = await sql`SELECT * FROM audio_generations WHERE id=${audioId} AND project_id=${projectId}`;
    if (!audioRow || audioRow.status === "READY") return;
    const [project] = await sql`SELECT * FROM projects WHERE id=${projectId}`;
    const [voice] = await sql`SELECT * FROM voices WHERE id=${audioRow.voiceId}`;
    const [script] = await sql`SELECT * FROM scripts WHERE id=${audioRow.scriptId}`;
    if (!project || !voice || !script) throw new Error("VBee finalize context missing");
    const response = await fetch(String(audioUrl));
    if (!response.ok) throw new Error(`VBee audio download HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const dir = await tempDir(`vbee-${audioId}`); const file = path.join(dir, "audio.mp3");
    try {
      await writeFile(file, buffer); const probe = await probeMedia(file); const duration = mediaDuration(probe);
      const mismatch = Math.abs(duration - Number(project.targetDuration)) / Number(project.targetDuration);
      if (mismatch > 0.20 && Number(audioRow.adjustmentCount || 0) < 1) {
        const rewritten = await rewriteScriptToDuration(script.scriptText, Number(project.targetDuration), duration > Number(project.targetDuration) ? "shorter" : "longer");
        const [v] = await sql`SELECT COALESCE(MAX(version),0) AS max FROM scripts WHERE project_id=${projectId}`;
        await sql`UPDATE scripts SET is_current=false WHERE project_id=${projectId}`;
        const [newScript] = await sql`INSERT INTO scripts (project_id,angle_id,style_key,target_duration,script_text,segments,estimated_duration,version,is_current) VALUES (${projectId},${script.angleId},${script.styleKey},${project.targetDuration},${rewritten},${JSON.stringify(segmentsFromText(rewritten, Number(project.targetDuration)))}::jsonb,${project.targetDuration},${Number(v.max)+1},true) RETURNING *`;
        await sql`UPDATE audio_generations SET status='SUPERSEDED',adjustment_count=1,updated_at=now() WHERE id=${audioId}`;
        const inputHash = stableHash({ text: rewritten, voiceId: voice.id, speed: voice.speed, provider: voice.provider });
        await updateProject(projectId, "GENERATING_AUDIO", 70, "Đang tự căn lại độ dài lời thoại");
        await enqueue("generate-audio", { projectId, userId: project.userId, voiceId: voice.id, inputHash, scriptId: newScript.id, adjustmentCount: 1 }, `audio-${projectId}-${inputHash}`);
        return;
      }
      const astream = probe.streams.find((s) => s.codec_type === "audio") || {};
      const key = `users/${project.userId}/projects/${projectId}/audio/${audioId}.mp3`;
      await uploadBuffer(key, buffer, response.headers.get("content-type") || "audio/mpeg");
      await sql`UPDATE audio_generations SET storage_key=${key},duration_seconds=${duration},codec_name=${String(astream.codec_name||'')},sample_rate=${Number(astream.sample_rate||0)},channels=${Number(astream.channels||0)},status='READY',updated_at=now() WHERE id=${audioId}`;
      await updateProject(projectId, "AUDIO_READY", 78, "Giọng nói đã sẵn sàng");
    } finally { await rm(dir, { recursive: true, force: true }); }
  }, "VBEE");
}

async function renderJob(job: Job) {
  return withLog(job, "render-video", async () => {
    const sql = db(); const { projectId, userId, audioId, inputHash } = job.data;
    const [project] = await sql`SELECT * FROM projects WHERE id=${projectId} AND user_id=${userId}`;
    const [audio] = await sql`SELECT * FROM audio_generations WHERE id=${audioId} AND project_id=${projectId} AND status='READY'`;
    const [script] = audio
      ? await sql`SELECT * FROM scripts WHERE id=${audio.scriptId} AND project_id=${projectId} LIMIT 1`
      : [];
    if (!project || !audio?.storageKey || !script) throw new Error("Render assets are not ready");
    const [cached] = await sql`SELECT o.* FROM render_jobs r JOIN render_outputs o ON o.render_job_id=r.id WHERE r.project_id=${projectId} AND r.input_hash=${inputHash} AND r.status='COMPLETED' LIMIT 1`;
    if (cached?.storageKey) { await updateProject(projectId, "COMPLETED", 100, "Video đã sẵn sàng"); return; }
    const [renderRow] = await sql`INSERT INTO render_jobs (project_id,audio_generation_id,input_hash,status,attempt) VALUES (${projectId},${audioId},${inputHash},'PROCESSING',1) ON CONFLICT (project_id,input_hash) DO UPDATE SET status='PROCESSING',attempt=render_jobs.attempt+1,updated_at=now() RETURNING *`;
    const dir = await tempDir(`render-${projectId}`);
    try {
      const video = path.join(dir, "video.mp4"), audioFile = path.join(dir, "audio.mp3"), output = path.join(dir, "output.mp4"), repaired = path.join(dir, "repaired.mp4"), srt = path.join(dir, "captions.srt");
      await Promise.all([downloadToFile(project.normalizedVideoKey || project.sourceVideoKey, video), downloadToFile(audio.storageKey, audioFile)]);
      let subtitleFile: string | undefined;
      if (project.subtitlesEnabled && Array.isArray(script.segments) && script.segments.length) { await writeSrt(script.segments, srt); subtitleFile = srt; }
      await updateProject(projectId, "RENDERING", 88, "Đang mã hóa H.264/AAC và căn timeline");
      const { expectedDuration } = await renderSocialVideo({ video, audio: audioFile, output, subtitleFile });
      await updateProject(projectId, "VALIDATING", 95, "Đang kiểm tra metadata và độ tương thích");
      let validation = await validateSocialVideo(output, expectedDuration); let finalFile = output;
      if (!validation.ok) {
        await repairSocialVideo({ source: output, output: repaired, expectedDuration });
        validation = await validateSocialVideo(repaired, expectedDuration); finalFile = repaired;
      }
      if (!validation.ok) {
        await sql`UPDATE render_jobs SET status='FAILED',error_code='VALIDATION_FAILED',updated_at=now() WHERE id=${renderRow.id}`;
        throw new Error(`Video validation failed: ${validation.errors.join("; ")}`);
      }
      const key = `users/${userId}/projects/${projectId}/renders/${renderRow.id}.mp4`;
      await uploadFile(key, finalFile, "video/mp4");
      await sql`INSERT INTO render_outputs (project_id,render_job_id,storage_key,duration_seconds,validation) VALUES (${projectId},${renderRow.id},${key},${validation.duration},${JSON.stringify(validation)}::jsonb)`;
      await sql`UPDATE render_jobs SET status='COMPLETED',updated_at=now() WHERE id=${renderRow.id}`;
      await updateProject(projectId, "COMPLETED", 100, "Video MP4 đã sẵn sàng để tải xuống");
    } finally { await rm(dir, { recursive: true, force: true }); }
  }, "FFMPEG");
}

const worker = new Worker("reviewflow", async (job) => {
  switch (job.name) {
    case "analyze-video": return analyzeJob(job);
    case "generate-script": return scriptJob(job);
    case "clone-voice": return cloneVoiceJob(job);
    case "generate-audio": return audioJob(job);
    case "finalize-vbee-audio": return finalizeVbeeJob(job);
    case "render-video": return renderJob(job);
    default: throw new Error(`Unknown job: ${job.name}`);
  }
}, { connection, concurrency });

worker.on("completed", (job) => console.log(`[worker] completed ${job.name} ${job.id}`));
worker.on("failed", async (job, error) => {
  console.error(`[worker] failed ${job?.name} ${job?.id}`, error);
  const attempts = Number(job?.opts.attempts || 1);
  if (job && job.attemptsMade >= attempts && job.data?.projectId) {
    await updateProject(job.data.projectId, "FAILED", 0, "Không thể xử lý tác vụ. Hãy thử lại.").catch(console.error);
  }
});
console.log(`[worker] ReviewFlow worker started with concurrency=${concurrency}`);
