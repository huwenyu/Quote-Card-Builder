import type { PosterContent } from "@/types/poster";

type ValidationResult =
  | { ok: true }
  | { ok: false; errors: { name?: string; quote?: string } };

export function validatePosterContent(content: PosterContent): ValidationResult {
  const errors: { name?: string; quote?: string } = {};
  const name = content.name.trim();
  const quote = content.quote.replace(/\r\n/g, "\n").trim();

  if (name.length === 0) errors.name = "请输入名人";
  if (name.length > 60) errors.name = "名人最长 60 字";

  if (quote.length === 0) errors.quote = "请输入名言";
  if (quote.length > 500) errors.quote = "名言最长 500 字";

  if (errors.name || errors.quote) return { ok: false, errors };
  return { ok: true };
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

export function createPosterFilename({
  ext,
  date,
}: {
  ext: "png" | "jpeg" | "jpg";
  date?: Date;
}) {
  const d = date ?? new Date();
  const ts = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
  return `quote-${ts}.${ext}`;
}

