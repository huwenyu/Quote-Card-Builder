import { useEffect, useRef, useState } from "react";
import type { PosterContent } from "@/types/poster";

function normalizeMultilineText(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

export default function QuotePosterPreview({
  content,
  portraitUrl,
}: {
  content: PosterContent;
  portraitUrl?: string;
}) {
  const quote = normalizeMultilineText(content.quote);
  const name = content.name.trim();
  const description = content.description.trim();
  const isEmpty = quote.length === 0;

  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(44);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [maxFontSize, setMaxFontSize] = useState(44);

  // Calculate max font size based on container dimensions
  useEffect(() => {
    const container = containerRef.current;
    if (!container || isEmpty) return;

    const calculateMaxFontSize = () => {
      const containerHeight = container.clientHeight;
      const containerWidth = container.clientWidth;
      
      // Base max font size on container height and width
      // Larger containers get larger max font sizes
      const heightBasedMax = Math.min(72, Math.max(44, containerHeight * 0.12));
      const widthBasedMax = Math.min(72, Math.max(44, containerWidth * 0.08));
      
      // Use the smaller of the two to ensure it fits
      const newMaxFontSize = Math.min(heightBasedMax, widthBasedMax);
      setMaxFontSize(newMaxFontSize);
      setFontSize((prev) => Math.min(prev, newMaxFontSize));
    };

    const resizeObserver = new ResizeObserver(calculateMaxFontSize);
    resizeObserver.observe(container);
    calculateMaxFontSize();

    return () => resizeObserver.disconnect();
  }, [isEmpty]);

  // Auto-adjust font size based on container height
  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl || isEmpty) return;

    let rafId: number;
    let attempts = 0;
    const maxAttempts = 10;

    const adjustFontSize = () => {
      if (attempts >= maxAttempts) {
        setIsAdjusting(false);
        return;
      }
      attempts++;

      const containerHeight = container.clientHeight;
      const textHeight = textEl.scrollHeight;
      const padding = 48; // p-6 = 24px * 2
      const availableHeight = containerHeight - padding;

      if (textHeight > availableHeight) {
        // Text is overflowing, reduce font size
        setFontSize((prev) => {
          const newSize = Math.max(16, prev * 0.9);
          if (Math.abs(newSize - prev) < 0.5) {
            setIsAdjusting(false);
            return prev;
          }
          rafId = requestAnimationFrame(adjustFontSize);
          return newSize;
        });
      } else if (textHeight < availableHeight * 0.85 && fontSize < maxFontSize) {
        // Text has too much space, increase font size slightly
        setFontSize((prev) => {
          const newSize = Math.min(maxFontSize, prev * 1.05);
          if (Math.abs(newSize - prev) < 0.5) {
            setIsAdjusting(false);
            return prev;
          }
          rafId = requestAnimationFrame(adjustFontSize);
          return newSize;
        });
      } else {
        setIsAdjusting(false);
      }
    };

    const startAdjusting = () => {
      attempts = 0;
      setIsAdjusting(true);
      rafId = requestAnimationFrame(adjustFontSize);
    };

    // Use ResizeObserver to detect container size changes
    const resizeObserver = new ResizeObserver(() => {
      if (!isAdjusting) {
        startAdjusting();
      }
    });

    resizeObserver.observe(container);
    startAdjusting();

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [quote, description, isEmpty, maxFontSize]);

  const authorSize = Math.max(11, Math.min(14, fontSize * 0.32));
  const descSize = Math.max(10, Math.min(12, fontSize * 0.27));

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-[0_18px_60px_rgba(0,0,0,0.35)] sm:rounded-2xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.04),transparent_55%)]" />

      <div className="absolute inset-0 grid grid-cols-[1.15fr_0.85fr]">
        <div
          ref={containerRef}
          className="flex h-full items-center justify-center overflow-hidden p-4 sm:p-6"
        >
          <div
            ref={textRef}
            className="w-full max-w-[30ch] overflow-hidden text-left sm:max-w-[36ch]"
          >
            <div
              className={
                isEmpty
                  ? "font-sans text-[16px] font-medium leading-[1.35] text-white/45"
                  : "font-serif italic tracking-tight text-white"
              }
              style={{
                whiteSpace: "pre-line",
                fontSize: isEmpty ? undefined : `${fontSize}px`,
                lineHeight: isEmpty ? undefined : "1.15",
              }}
            >
              {isEmpty ? "预览将在这里显示" : quote}
            </div>

            {!isEmpty && (
              <div className="mt-4 sm:mt-6">
                <div
                  className="font-sans font-semibold tracking-[0.22em] text-white"
                  style={{ fontSize: `${authorSize}px` }}
                >
                  {(name || "匿名").toUpperCase()}
                </div>
                {description.length > 0 && (
                  <div
                    className="mt-2 font-sans italic text-white/60"
                    style={{ fontSize: `${descSize}px` }}
                  >
                    {description}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="relative h-full w-full overflow-hidden bg-black">
          {portraitUrl && (
            <img
              src={portraitUrl}
              alt={name.length > 0 ? name : "Portrait"}
              className="h-full w-full object-cover opacity-75"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-l from-black/10 via-black/35 to-black/80" />
        </div>
      </div>
    </div>
  );
}
