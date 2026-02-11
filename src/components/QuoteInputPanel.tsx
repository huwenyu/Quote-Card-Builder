import { useState } from "react";
import type { PosterContent } from "@/types/poster";

type Props = {
  content: PosterContent;
  onChange: (next: PosterContent) => void;
  onDownload: () => void | Promise<void>;
  onGeneratePortrait?: () => void | Promise<void>;
  isGeneratingPortrait: boolean;
  isExporting: boolean;
  errors?: { name?: string; quote?: string; export?: string };
};

export default function QuoteInputPanel({
  content,
  onChange,
  onDownload,
  onGeneratePortrait,
  isGeneratingPortrait,
  isExporting,
  errors,
}: Props) {
  const [showHint, setShowHint] = useState(false);
  const [isNameOpen, setIsNameOpen] = useState(false);
  const [isFilteringNames, setIsFilteringNames] = useState(false);
  const namePresets = ["Albert Einstein", "Bruce Lee", "Steve Jobs", "鲁迅"];
  const normalizedName = content.name.trim().toLowerCase();
  const filteredPresets =
    normalizedName.length === 0
      ? namePresets
      : namePresets.filter((preset) => preset.toLowerCase().includes(normalizedName));
  const visiblePresets = isFilteringNames
    ? filteredPresets.length > 0
      ? filteredPresets
      : namePresets
    : namePresets;

  const handleGeneratePortrait = async () => {
    if (!onGeneratePortrait || !content.name.trim()) return;
    await onGeneratePortrait();
  };

  return (
    <section className="w-full max-w-[640px] rounded-xl border border-zinc-200/80 bg-white p-4 pb-10 shadow-sm sm:p-6">
      <div className="space-y-4 sm:space-y-5">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium leading-none text-zinc-700">
            名人
          </label>
          <div className="relative">
            <input
              id="name"
              name="name"
              type="text"
              required
              value={content.name}
              maxLength={60}
              placeholder="例如：Albert Einstein"
              onChange={(e) => {
                onChange({ ...content, name: e.target.value });
                setIsNameOpen(true);
                setIsFilteringNames(true);
              }}
              onFocus={() => {
                setShowHint(true);
                setIsNameOpen(true);
                setIsFilteringNames(false);
              }}
              onBlur={() => {
                setShowHint(false);
                setTimeout(() => setIsNameOpen(false), 120);
              }}
              aria-invalid={Boolean(errors?.name)}
              aria-describedby={errors?.name ? "name-error" : undefined}
              className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-950/10 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50"
            />
            {isNameOpen && visiblePresets.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
                {visiblePresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onChange({ ...content, name: preset });
                      setIsNameOpen(false);
                    }}
                    className="flex w-full items-center px-3 py-2 text-left text-sm text-zinc-900 hover:bg-zinc-50"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            )}
          </div>
          {showHint && !content.name.trim() && (
            <div className="text-xs text-zinc-500">
              输入名人名称，点击下方按钮，生成肖像
            </div>
          )}
          {errors?.name && (
            <div id="name-error" role="alert" className="text-xs text-red-600">
              {errors.name}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="quote" className="text-sm font-medium leading-none text-zinc-700">
            名言
          </label>
          <textarea
            id="quote"
            name="quote"
            required
            value={content.quote}
            maxLength={500}
            placeholder="请输入名言内容…"
            rows={7}
            onChange={(e) => onChange({ ...content, quote: e.target.value })}
            aria-invalid={Boolean(errors?.quote)}
            aria-describedby={errors?.quote ? "quote-error" : undefined}
            className="w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-950/10 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50"
          />
          {errors?.quote && (
            <div id="quote-error" role="alert" className="text-xs text-red-600">
              {errors.quote}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleGeneratePortrait}
          disabled={isGeneratingPortrait || !content.name.trim()}
          aria-label="AI 肖像生成"
          aria-busy={isGeneratingPortrait}
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-900/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50"
        >
          {isGeneratingPortrait ? "生成中…" : "生成"}
        </button>

        <button
          type="button"
          onClick={onDownload}
          disabled={isExporting}
          aria-label="下载名言卡片图片"
          aria-busy={isExporting}
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-zinc-100 px-4 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50"
        >
          {isExporting ? "生成中…" : "下载"}
        </button>

        {errors?.export && (
          <div role="alert" className="text-xs text-red-600">
            {errors.export}
          </div>
        )}
      </div>
    </section>
  );
}
