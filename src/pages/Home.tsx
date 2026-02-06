import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import QuoteInputPanel from "../components/QuoteInputPanel";
import QuotePosterPreview from "@/components/QuotePosterPreview";
import type { PosterContent } from "@/types/poster";
import { createPosterFilename, validatePosterContent } from "@/utils/posterExport";
import { generatePortrait } from "@/services/nanoBanana";

const initialContent: PosterContent = {
  quote:
    'Try to become\nnot a man of success,\nbut try rather to become\na man of value.',
  name: "Albert Einstein",
  description: "",
};

type QuoteInputPanelProps = {
  content: PosterContent;
  onChange: (next: PosterContent) => void;
  onDownload: () => void | Promise<void>;
  onGeneratePortrait?: () => void | Promise<void>;
  isExporting: boolean;
  errors?: { name?: string; quote?: string; export?: string };
};

const QuoteInputPanelTyped = QuoteInputPanel as unknown as (props: QuoteInputPanelProps) => JSX.Element;

export default function Home() {
  const [content, setContent] = useState<PosterContent>(initialContent);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [portraitUrl, setPortraitUrl] = useState<string>("https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=%5BRight%20Side%5D%3A%20A%20high-definition%2C%20realistic%20chest-up%20portrait%20of%20Albert%20Einstein%2C%20framed%20from%20the%20chest%20up%20to%20focus%20on%20the%20face%20and%20shoulders.%20Looking%20towards%20the%20camera%20with%20a%20calm%20expression.%20%5BLighting%5D%3A%20Cinematic%20studio%20lighting%2C%20Rembrandt%20lighting%20on%20the%20face%2C%20high%20contrast.%208k%20resolution%2C%20clean%20and%20sophisticated%20aesthetic.&image_size=portrait_4_3");
  const [errors, setErrors] = useState<{ name?: string; quote?: string; export?: string }>({});

  const handleDownload = async () => {
    const result = validatePosterContent(content);
    if (result.ok === false) {
      setErrors({ ...result.errors, export: undefined });
      return;
    }

    const node = exportRef.current;
    if (!node) {
      setErrors({ export: "生成失败，请重试" });
      return;
    }

    setErrors({});
    setIsExporting(true);
    try {
      const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 1 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = createPosterFilename({ ext: "png" });
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      setErrors({ export: "生成失败，请重试" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleGeneratePortrait = async () => {
    if (!content.name.trim()) return;

    try {
      const name = content.name.trim();
      const mood = "calm";
      const prompt = `A high-definition, realistic chest-up portrait of ${name}, looking towards the camera with a ${mood} expression. Cinematic studio lighting, Rembrandt lighting on the face, high contrast. 8k resolution, clean and sophisticated aesthetic.`;
      
      const newPortraitUrl = await generatePortrait(prompt);
      setPortraitUrl(newPortraitUrl);
    } catch (error: any) {
      console.error("Failed to generate portrait:", error);
      alert(`肖像生成失败: ${error.message || "未知错误"}`);
    }
  };

  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-[1400px] px-6 py-12">
        <header className="mb-8 flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-medium text-zinc-500">Quote Card Builder</p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">名言卡片生成器</h1>
        </header>

        <div className="flex flex-wrap justify-center gap-[24px]">
          <section className="w-[640px] rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
            <div className="text-sm font-medium text-zinc-600">实时预览</div>
            <div className="mt-5">
              <QuotePosterPreview content={content} portraitUrl={portraitUrl} />
            </div>
          </section>

          <QuoteInputPanelTyped
            content={content}
            errors={errors}
            isExporting={isExporting}
            onChange={(next) => {
              setContent(next);
              setErrors((prev) => ({ ...prev, name: undefined, quote: undefined, export: undefined }));
            }}
            onDownload={handleDownload}
            onGeneratePortrait={handleGeneratePortrait}
          />
        </div>
      </div>

      <div className="fixed left-[-10000px] top-0">
        <div ref={exportRef} style={{ width: 1200 }}>
          <QuotePosterPreview content={content} portraitUrl={portraitUrl} />
        </div>
      </div>
    </main>
  );
}
