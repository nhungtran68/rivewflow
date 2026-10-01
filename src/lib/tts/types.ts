export type TTSRequest = {
  text: string;
  externalVoiceId: string;
  speed?: number;
  callbackUrl?: string;
  idempotencyKey?: string;
};

export type TTSResult =
  | { mode: "sync"; audio: Buffer; contentType: string; providerRequestId?: string }
  | { mode: "async"; providerRequestId: string };

export interface TTSProvider {
  name: "VBEE" | "ELEVENLABS";
  synthesize(request: TTSRequest): Promise<TTSResult>;
  deleteVoice?(externalVoiceId: string): Promise<void>;
}
