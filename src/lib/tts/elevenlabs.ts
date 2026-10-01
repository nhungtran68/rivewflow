import { env, mustEnv } from "@/lib/config";
import type { TTSProvider, TTSRequest, TTSResult } from "@/lib/tts/types";

const BASE = "https://api.elevenlabs.io";

export class ElevenLabsProvider implements TTSProvider {
  name = "ELEVENLABS" as const;

  async synthesize(request: TTSRequest): Promise<TTSResult> {
    const format = env("ELEVENLABS_OUTPUT_FORMAT", "mp3_44100_128");
    const response = await fetch(`${BASE}/v1/text-to-speech/${encodeURIComponent(request.externalVoiceId)}?output_format=${encodeURIComponent(format)}`, {
      method: "POST",
      headers: { "xi-api-key": mustEnv("ELEVENLABS_API_KEY"), "Content-Type": "application/json" },
      body: JSON.stringify({
        text: request.text,
        model_id: env("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2"),
        voice_settings: request.speed ? { speed: request.speed } : undefined
      })
    });
    if (!response.ok) throw new Error(`ElevenLabs TTS HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
    return { mode: "sync", audio: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get("content-type") || "audio/mpeg", providerRequestId: response.headers.get("request-id") || undefined };
  }

  async cloneVoice(input: { name: string; files: Array<{ name: string; type: string; data: Buffer }>; removeBackgroundNoise?: boolean }) {
    const form = new FormData();
    form.set("name", input.name);
    form.set("remove_background_noise", String(Boolean(input.removeBackgroundNoise)));
    for (const f of input.files) form.append("files", new Blob([new Uint8Array(f.data)], { type: f.type || "audio/mpeg" }), f.name);
    const response = await fetch(`${BASE}/v1/voices/add`, { method: "POST", headers: { "xi-api-key": mustEnv("ELEVENLABS_API_KEY") }, body: form });
    const text = await response.text();
    if (!response.ok) throw new Error(`ElevenLabs clone HTTP ${response.status}: ${text.slice(0, 500)}`);
    return JSON.parse(text) as { voice_id: string; requires_verification?: boolean };
  }

  async deleteVoice(externalVoiceId: string) {
    const response = await fetch(`${BASE}/v1/voices/${encodeURIComponent(externalVoiceId)}`, { method: "DELETE", headers: { "xi-api-key": mustEnv("ELEVENLABS_API_KEY") } });
    if (!response.ok) throw new Error(`ElevenLabs delete HTTP ${response.status}`);
  }
}
