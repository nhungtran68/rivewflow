import { env, mustEnv } from "@/lib/config";
import type { TTSProvider, TTSRequest, TTSResult } from "@/lib/tts/types";

export class VbeeProvider implements TTSProvider {
  name = "VBEE" as const;

  async synthesize(request: TTSRequest): Promise<TTSResult> {
    if (!request.callbackUrl) throw new Error("VBee requires callbackUrl");
    const response = await fetch(env("VBEE_API_URL", "https://api.vbee.vn/v1/tts"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mustEnv("VBEE_TOKEN")}`
      },
      body: JSON.stringify({
        app_id: mustEnv("VBEE_APP_ID"),
        input_text: request.text,
        voice_code: request.externalVoiceId,
        audio_type: "mp3",
        speed_rate: request.speed || 1,
        callback_url: request.callbackUrl
      })
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`VBee TTS HTTP ${response.status}: ${text.slice(0, 500)}`);
    const data = JSON.parse(text);
    const requestId = data?.result?.request_id || data?.request_id;
    if (!requestId) throw new Error(`VBee response missing request_id: ${text.slice(0, 500)}`);
    return { mode: "async", providerRequestId: String(requestId) };
  }
}
