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

const createPortraitPrompt = (name: string, mood: string) =>
  `A high-definition, realistic chest-up close-up portrait of ${name}, with a ${mood} expression. Camera is slightly closer for stronger visual impact; head-and-shoulders framing with the face larger in frame. Camera angle: 15-degree left profile (subject turned 15 degrees to their left), natural three-quarter view, not frontal. The subject is fully clothed, wearing attire that matches the person’s commonly recognized public image (era-appropriate and profession-appropriate). No bare shoulders, no exposed chest, no bare skin below the neck. The clothing is clearly visible. Cinematic studio lighting, Rembrandt lighting on the face, high contrast. 8k resolution, clean and sophisticated aesthetic. The subject must match ${name} and not be a cartoon, robot, signage, poster, or text-only image.`;

const createInitialPortraitUrl = (prompt: string) => {
  const encodedPrompt = encodeURIComponent(prompt);
  return `https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=${encodedPrompt}&image_size=portrait_4_3`;
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
  const [portraitUrl, setPortraitUrl] = useState<string>(() =>
    createInitialPortraitUrl(createPortraitPrompt(initialContent.name, "calm"))
  );
  const [exportPortraitUrl, setExportPortraitUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string; quote?: string; export?: string }>({});

  const getExportPortraitUrl = (url?: string) => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      if (parsed.origin !== window.location.origin) {
        return `/api/image?url=${encodeURIComponent(url)}`;
      }
      return url;
    } catch {
      return null;
    }
  };

  const waitForImagesLoaded = async (node: HTMLElement) => {
    const images = Array.from(node.querySelectorAll("img"));
    if (images.length === 0) return;
    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve();
              return;
            }
            const cleanup = () => {
              img.removeEventListener("load", onLoad);
              img.removeEventListener("error", onError);
            };
            const onLoad = () => {
              cleanup();
              resolve();
            };
            const onError = () => {
              cleanup();
              resolve();
            };
            img.addEventListener("load", onLoad);
            img.addEventListener("error", onError);
          })
      )
    );
  };

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
    const resolvedExportPortraitUrl = getExportPortraitUrl(portraitUrl);
    setExportPortraitUrl(resolvedExportPortraitUrl);
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await waitForImagesLoaded(node);
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
      setExportPortraitUrl(null);
    }
  };

  const handleGeneratePortrait = async () => {
    if (!content.name.trim()) return;

    try {
      const name = content.name.trim();
      const mood = "calm";
      const prompt = createPortraitPrompt(name, mood);
      
      const newPortraitUrl = await generatePortrait(prompt);
      setPortraitUrl(newPortraitUrl);
    } catch (error: any) {
      console.error("Failed to generate portrait:", error);
      alert(`肖像生成失败: ${error.message || "未知错误"}`);
    }
  };

  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-[1400px] px-4 pb-[calc(40px+env(safe-area-inset-bottom))] pt-8 sm:px-6 sm:py-12">
        <header className="mb-6 flex flex-col items-center gap-2 text-center sm:mb-8">
          <p className="text-xs font-medium text-zinc-500 sm:text-sm">Quote Card Builder</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">名言卡片生成器</h1>
        </header>

        <div className="flex flex-col items-center gap-5 sm:gap-6">
          <section className="w-full max-w-[640px] rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm sm:p-6">
            <div className="text-sm font-medium text-zinc-600">实时预览</div>
            <div className="mt-4 sm:mt-5">
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
          <QuotePosterPreview content={content} portraitUrl={exportPortraitUrl ?? portraitUrl} />
        </div>
      </div>
    </main>
  );
}
