import { ElevenLabsProvider } from "@/lib/tts/elevenlabs";
import { VbeeProvider } from "@/lib/tts/vbee";

export function ttsProvider(provider: string) {
  if (provider === "ELEVENLABS") return new ElevenLabsProvider();
  if (provider === "VBEE") return new VbeeProvider();
  throw new Error(`Unsupported TTS provider: ${provider}`);
}
