export const PROJECT_STATES = [
  "UPLOADING","UPLOADED","ANALYZING","ANALYZED","GENERATING_SCRIPT","SCRIPT_READY",
  "GENERATING_AUDIO","AUDIO_READY","RENDERING","VALIDATING","COMPLETED","FAILED"
] as const;
export type ProjectState = typeof PROJECT_STATES[number];

export const DEFAULT_STYLES = [
  { key: "natural_intro", name: "Giới thiệu tự nhiên", prompt: "Tự nhiên, gần gũi, như người thật đang chia sẻ trước camera." },
  { key: "ugc_tiktok", name: "Review UGC / TikTok", prompt: "Nhịp nhanh, đời thường, có cảm giác người dùng thật đang review." },
  { key: "problem_solution", name: "Vấn đề → Giải pháp", prompt: "Mở bằng nỗi đau cụ thể, dẫn sang giải pháp rõ ràng và hợp lý." },
  { key: "demo", name: "Demo / Hướng dẫn", prompt: "Ưu tiên thao tác trực quan và lời dẫn ăn khớp cảnh quay." },
  { key: "story", name: "Storytelling trải nghiệm", prompt: "Kể một tình huống có mở đầu, chuyển biến và kết quả tự nhiên." },
  { key: "viral", name: "Bắt trend / Viral", prompt: "Hook nhanh, bất ngờ, ngôn ngữ mạng xã hội nhưng không lố." },
  { key: "expert", name: "Chuyên gia tư vấn", prompt: "Chắc chắn, rõ ràng, giải thích lợi ích có căn cứ và không thổi phồng." },
  { key: "conversion", name: "Bán hàng chuyển đổi", prompt: "Tập trung lý do mua, giảm do dự, CTA rõ nhưng không ép buộc." }
] as const;

export type VideoAnalysis = {
  product_detected: string;
  scenes: Array<{ id: string; timestamp?: number; description: string }>;
  visible_features: string[];
  possible_selling_points: string[];
  interesting_visual_moments: string[];
  recommended_hooks: string[];
  uncertain_information: string[];
  warnings: string[];
};

export type ScriptSegment = {
  start: number;
  end: number;
  scene_id: string;
  voice_text: string;
  caption: string;
};
