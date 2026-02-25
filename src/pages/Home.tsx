import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import QuoteInputPanel from "../components/QuoteInputPanel";
import QuotePosterPreview from "@/components/QuotePosterPreview";
import FeedbackWidget from "@/components/FeedbackWidget";
import type { PosterContent } from "@/types/poster";
import { createPosterFilename, validatePosterContent } from "@/utils/posterExport";
import { generatePortrait } from "@/services/nanoBanana";

const initialContent: PosterContent = {
  quote:
    'Try to become\nnot a man of success,\nbut try rather to become\na man of value.',
  name: "Albert Einstein",
  description: "",
};

const createPortraitPrompt = (name: string) =>
  `一张高清晰度、逼真的${name}半身肖像，采用专业摄影棚人像风格。相机距离适中，头肩构图，脸部在画面中占比较大。相机角度：左15度侧面（拍摄对象向左转15度），自然四分之三视角，非正面。拍摄对象衣着完整，穿着与其公认的公众形象相匹配的服装（符合时代背景和职业特点），正装或经典服饰，衣物清晰可见。无裸露、无暴露、颈部以下无裸露皮肤。背景为纯黑色（#000000），干净简洁。灯光为电影级工作室灯光，伦勃朗式光线，高对比度。画面干净且具有精致美感。拍摄对象必须与${name}相符，不得是卡通、机器人、标识、海报或纯文字图像。`;

const createInitialPortraitUrl = (prompt: string) => {
  const encodedPrompt = encodeURIComponent(prompt);
  return `https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=${encodedPrompt}&image_size=portrait_4_3`;
};

type QuoteInputPanelProps = {
  content: PosterContent;
  onChange: (next: PosterContent) => void;
  onDownload: () => void | Promise<void>;
  onGeneratePortrait?: () => void | Promise<void>;
  isGeneratingPortrait: boolean;
  isExporting: boolean;
  errors?: { name?: string; quote?: string; export?: string };
};

const QuoteInputPanelTyped = QuoteInputPanel as unknown as (props: QuoteInputPanelProps) => JSX.Element;

export default function Home() {
  const [content, setContent] = useState<PosterContent>(initialContent);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isGeneratingPortrait, setIsGeneratingPortrait] = useState(false);
  const [portraitUrl, setPortraitUrl] = useState<string>(() =>
    createInitialPortraitUrl(createPortraitPrompt(initialContent.name))
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

    setIsGeneratingPortrait(true);
    try {
      const name = content.name.trim();
      const prompt = createPortraitPrompt(name);
      
      const newPortraitUrl = await generatePortrait(prompt);
      setPortraitUrl(newPortraitUrl);
    } catch (error: any) {
      console.error("Failed to generate portrait:", error);
      alert(`肖像生成失败: ${error.message || "未知错误"}`);
    } finally {
      setIsGeneratingPortrait(false);
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
            <div className="relative mt-4 sm:mt-5">
              {/* 边框容器：负责裁剪溢出的光效，并提供圆角 */}
              <div className={`relative z-0 overflow-hidden rounded-[14px] sm:rounded-[18px] transition-all duration-500 ${isGeneratingPortrait ? "p-[3px]" : "p-0"}`}>
                
                {/* 弥散光效层 - 仅在生成时显示 */}
                <div 
                  className={`absolute inset-0 -z-20 transition-opacity duration-500 ${isGeneratingPortrait ? "opacity-60" : "opacity-0"}`}
                  style={{ filter: "blur(20px)" }}
                >
                  <div className="absolute left-1/2 top-1/2 h-[300%] w-[300%] -translate-x-1/2 -translate-y-1/2">
                    <div
                      className="h-full w-full"
                      style={{
                        background: `
                          radial-gradient(circle, #dd7bbb 10%, #dd7bbb00 20%), 
                          radial-gradient(circle at 40% 40%, #d79f1e 5%, #d79f1e00 15%), 
                          radial-gradient(circle at 60% 60%, #5a922c 10%, #5a922c00 20%), 
                          radial-gradient(circle at 40% 60%, #4c7894 10%, #4c789400 20%), 
                          repeating-conic-gradient( 
                            from 236.84deg at 50% 50%, 
                            #dd7bbb 0%, 
                            #d79f1e 25%, 
                            #5a922c 50%, 
                            #4c7894 75%, 
                            #dd7bbb 100% 
                          )
                        `,
                        animation: "spin 2s linear infinite",
                      }}
                    />
                  </div>
                </div>

                {/* 旋转的光效背景 - 尺寸放大以覆盖旋转时的对角线 */}
                <div className={`absolute left-1/2 top-1/2 -z-10 h-[300%] w-[300%] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500 ${isGeneratingPortrait ? "opacity-100" : "opacity-0"}`}>
                  <div
                    className="h-full w-full"
                    style={{
                      background: `
                        radial-gradient(circle, #dd7bbb 10%, #dd7bbb00 20%), 
                        radial-gradient(circle at 40% 40%, #d79f1e 5%, #d79f1e00 15%), 
                        radial-gradient(circle at 60% 60%, #5a922c 10%, #5a922c00 20%), 
                        radial-gradient(circle at 40% 60%, #4c7894 10%, #4c789400 20%), 
                        repeating-conic-gradient( 
                          from 236.84deg at 50% 50%, 
                          #dd7bbb 0%, 
                          #d79f1e 25%, 
                          #5a922c 50%, 
                          #4c7894 75%, 
                          #dd7bbb 100% 
                        )
                      `,
                      animation: "spin 2s linear infinite",
                    }}
                  />
                </div>

                {/* 卡片主体 - 位于光效之上 */}
                <div className="relative z-10">
                  <QuotePosterPreview
                    content={content}
                    portraitUrl={portraitUrl}
                    isGeneratingPortrait={isGeneratingPortrait}
                  />
                  {/* 扫描线动画 */}
                    {isGeneratingPortrait && (
                      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-xl sm:rounded-2xl">
                        <div 
                          className="h-[80%] w-full"
                          style={{ 
                            background: 'linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.15) 50%, transparent)',
                            animation: 'scan 2.5s linear infinite' 
                          }}
                        />
                      </div>
                    )}
                </div>
              </div>
            </div>
          </section>

          <QuoteInputPanelTyped
            content={content}
            errors={errors}
            isGeneratingPortrait={isGeneratingPortrait}
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
          <QuotePosterPreview
            content={content}
            portraitUrl={exportPortraitUrl ?? portraitUrl}
            isGeneratingPortrait={false}
          />
        </div>
      </div>
      <FeedbackWidget />
    </main>
  );
}
