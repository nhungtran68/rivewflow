import { readFile } from "node:fs/promises";
import { env, mustEnv } from "@/lib/config";
import type { ScriptSegment, VideoAnalysis } from "@/lib/types";

function extractJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(cleaned) as T; } catch {}
  const start = Math.min(...[cleaned.indexOf("{"), cleaned.indexOf("[")].filter((x) => x >= 0));
  const endObj = cleaned.lastIndexOf("}");
  const endArr = cleaned.lastIndexOf("]");
  const end = Math.max(endObj, endArr);
  if (!Number.isFinite(start) || start < 0 || end <= start) throw new Error("AI did not return valid JSON");
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

async function chat(messages: unknown[], model: string, temperature = 0.5) {
  const base = env("DEEPSEEK_BASE_URL", "https://api.deepseek.com").replace(/\/$/, "");
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${mustEnv("DEEPSEEK_API_KEY")}` },
    body: JSON.stringify({ model, messages, temperature })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`DeepSeek HTTP ${response.status}: ${text.slice(0, 500)}`);
  const data = JSON.parse(text);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek returned empty content");
  return String(content);
}

export async function analyzeVideoFrames(input: {
  product: Record<string, string | null | undefined>;
  frames: Array<{ id: string; timestamp: number; file: string }>;
}): Promise<VideoAnalysis> {
  const imageParts = await Promise.all(input.frames.map(async (frame) => ({
    type: "image_url",
    image_url: { url: `data:image/jpeg;base64,${(await readFile(frame.file)).toString("base64")}`, detail: "low" },
    _frame_meta: { id: frame.id, timestamp: frame.timestamp }
  })));

  const frameLegend = input.frames.map((f, i) => `Ảnh ${i + 1}: scene_id=${f.id}, timestamp=${f.timestamp.toFixed(2)}s`).join("\n");
  const prompt = `Bạn là AI Vision phân tích video review sản phẩm.\n\nThông tin do người dùng cung cấp (ưu tiên cao hơn suy đoán hình ảnh):\n${JSON.stringify(input.product, null, 2)}\n\nÁnh xạ frame:\n${frameLegend}\n\nQUY TẮC: Chỉ kết luận điều nhìn thấy hoặc người dùng đã cung cấp. Không tự bịa chất liệu, thành phần, công dụng, xuất xứ, kích thước, giá, chứng nhận hay kết quả sử dụng. Mọi điều chưa chắc phải đưa vào uncertain_information.\n\nTrả về JSON THUẦN theo schema:\n{\n  "product_detected":"",\n  "scenes":[{"id":"scene-1","timestamp":0,"description":""}],\n  "visible_features":[],\n  "possible_selling_points":[],\n  "interesting_visual_moments":[],\n  "recommended_hooks":[],\n  "uncertain_information":[],\n  "warnings":[]\n}`;

  const content = await chat([
    { role: "system", content: "Phân tích trung thực, thực dụng, không hallucinate. Chỉ trả JSON hợp lệ." },
    { role: "user", content: [{ type: "text", text: prompt }, ...imageParts.map(({ _frame_meta, ...x }) => x)] }
  ], env("DEEPSEEK_VISION_MODEL", "deepseek-flash"), 0.2);
  return extractJson<VideoAnalysis>(content);
}

export type ContentAngle = { title: string; hook: string; insight: string; product_focus: string; scene_suggestion: string; cta: string; ai_recommended?: boolean };

export async function generateAngles(analysis: VideoAnalysis, product: Record<string, unknown>): Promise<ContentAngle[]> {
  const content = await chat([
    { role: "system", content: "Bạn là chiến lược gia nội dung video ngắn. Không bịa thông tin sản phẩm. Chỉ trả JSON." },
    { role: "user", content: `Tạo 5 góc khai thác khác nhau cho video review.\nDữ liệu sản phẩm: ${JSON.stringify(product)}\nPhân tích hình ảnh: ${JSON.stringify(analysis)}\nTrả JSON dạng {"angles":[{"title":"","hook":"","insight":"","product_focus":"","scene_suggestion":"","cta":"","ai_recommended":false}]}. Chọn đúng 1 góc ai_recommended=true.` }
  ], env("DEEPSEEK_TEXT_MODEL", "deepseek-flash"), 0.7);
  const parsed = extractJson<{ angles: ContentAngle[] }>(content);
  return parsed.angles?.slice(0, 5) || [];
}

export async function generateScript(input: {
  product: Record<string, unknown>;
  analysis: VideoAnalysis;
  angle: ContentAngle;
  styleName: string;
  stylePrompt: string;
  targetDuration: number;
}) {
  const content = await chat([
    { role: "system", content: "Bạn viết kịch bản review video ngắn bằng tiếng Việt tự nhiên. Không mô tả máy móc hình ảnh. Không bịa. Chỉ trả JSON." },
    { role: "user", content: `Viết kịch bản ${input.targetDuration} giây.\nPhong cách: ${input.styleName} — ${input.stylePrompt}\nGóc khai thác: ${JSON.stringify(input.angle)}\nSản phẩm: ${JSON.stringify(input.product)}\nScene đã thấy: ${JSON.stringify(input.analysis.scenes)}\nThông tin không chắc: ${JSON.stringify(input.analysis.uncertain_information)}\n\nCấu trúc: 0-3s hook mạnh nhưng thật; phần giữa tạo tò mò/review/demo/lợi ích; cuối có lý do hành động + CTA. Không liệt kê khô cứng. Lời thoại phải phù hợp cảnh đang xuất hiện.\nTrả JSON: {"script_text":"toàn bộ lời thoại liền mạch","estimated_duration":${input.targetDuration},"segments":[{"start":0,"end":3,"scene_id":"scene-1","voice_text":"","caption":""}]}. Tổng end không vượt quá ${input.targetDuration}.` }
  ], env("DEEPSEEK_TEXT_MODEL", "deepseek-flash"), 0.75);
  return extractJson<{ script_text: string; estimated_duration: number; segments: ScriptSegment[] }>(content);
}

export async function rewriteScriptToDuration(scriptText: string, targetSeconds: number, direction: "shorter" | "longer") {
  const content = await chat([
    { role: "system", content: "Bạn chỉnh độ dài kịch bản tiếng Việt, giữ nguyên sự thật và CTA. Chỉ trả JSON." },
    { role: "user", content: `Kịch bản hiện tại:\n${scriptText}\n\nHãy viết ${direction === "shorter" ? "ngắn hơn" : "dài hơn"} để phù hợp khoảng ${targetSeconds} giây đọc tự nhiên. Trả {"script_text":"..."}.` }
  ], env("DEEPSEEK_TEXT_MODEL", "deepseek-flash"), 0.4);
  return extractJson<{ script_text: string }>(content).script_text;
}

export async function refineScriptText(scriptText: string, action: "rewrite"|"shorter"|"longer"|"stronger_hook"|"natural"|"sales", targetSeconds: number) {
  const guide: Record<string,string> = {
    rewrite: "Viết lại toàn bộ, giữ đúng dữ kiện nhưng diễn đạt mới mẻ hơn.",
    shorter: "Rút gọn, bỏ phần thừa, vẫn giữ hook và CTA.",
    longer: "Mở rộng tự nhiên bằng ngữ cảnh/lợi ích đã có dữ kiện, tuyệt đối không bịa.",
    stronger_hook: "Tăng sức hút 3 giây đầu nhưng không giật tít sai sự thật.",
    natural: "Làm lời thoại tự nhiên như người thật đang review, bớt văn viết.",
    sales: "Tăng tính chuyển đổi, xử lý do dự và CTA rõ hơn nhưng không phóng đại."
  };
  const content = await chat([
    { role: "system", content: "Bạn là biên tập viên kịch bản video ngắn. Không thêm dữ kiện mới không có căn cứ. Chỉ trả JSON." },
    { role: "user", content: `Kịch bản hiện tại:\n${scriptText}\n\nYêu cầu: ${guide[action]}\nThời lượng mục tiêu khoảng ${targetSeconds} giây. Trả JSON {"script_text":"..."}.` }
  ], env("DEEPSEEK_TEXT_MODEL", "deepseek-flash"), 0.65);
  return extractJson<{script_text:string}>(content).script_text;
}
