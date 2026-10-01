import { createHash } from "node:crypto";
export function stableHash(value: unknown) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex").slice(0, 24);
}
