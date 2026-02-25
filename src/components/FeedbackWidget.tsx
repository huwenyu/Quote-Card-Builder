import { useEffect, useMemo, useState } from "react";
import { submitFeedback } from "@/services/supabase";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [content, setContent] = useState("");
  const [errors, setErrors] = useState<{ email?: string; content?: string; submit?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const remainingCount = useMemo(() => 300 - content.length, [content.length]);

  useEffect(() => {
    if (!toastVisible) return;
    const timer = setTimeout(() => setToastVisible(false), 2400);
    return () => clearTimeout(timer);
  }, [toastVisible]);

  const resetForm = () => {
    setEmail("");
    setContent("");
    setErrors({});
  };

  const handleClose = () => {
    setIsOpen(false);
    setErrors({});
  };

  const handleSubmit = async () => {
    const nextErrors: { email?: string; content?: string } = {};
    const trimmedEmail = email.trim();
    const trimmedContent = content.trim();

    if (!trimmedEmail) {
      nextErrors.email = "请输入邮箱";
    } else if (!emailPattern.test(trimmedEmail)) {
      nextErrors.email = "邮箱格式不正确";
    }

    if (!trimmedContent) {
      nextErrors.content = "请输入反馈内容";
    } else if (trimmedContent.length > 300) {
      nextErrors.content = "反馈内容不能超过 300 字";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await submitFeedback(trimmedEmail, trimmedContent);
      resetForm();
      setIsOpen(false);
      setToastVisible(true);
    } catch (error: any) {
      const rawMessage = String(error?.message || "");
      const submitMessage = rawMessage.includes("row-level security")
        ? "提交被拦截：请在 Supabase 为 feedback 表启用匿名插入策略"
        : rawMessage || "提交失败，请稍后重试";
      setErrors({ submit: submitMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-[calc(24px+env(safe-area-inset-bottom))] right-6 z-40 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-zinc-900/20 transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        意见反馈
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900">意见反馈</h2>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md px-2 py-1 text-sm text-zinc-500 transition hover:bg-zinc-100"
              >
                关闭
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label htmlFor="feedback-email" className="text-sm font-medium text-zinc-700">
                  邮箱
                </label>
                <input
                  id="feedback-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setErrors((prev) => ({ ...prev, email: undefined, submit: undefined }));
                  }}
                  placeholder="your@email.com"
                  className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-950/10 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                />
                {errors.email && (
                  <div role="alert" className="text-xs text-red-600">
                    {errors.email}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="feedback-content" className="text-sm font-medium text-zinc-700">
                  反馈内容
                </label>
                <textarea
                  id="feedback-content"
                  required
                  rows={5}
                  maxLength={300}
                  value={content}
                  onChange={(event) => {
                    setContent(event.target.value);
                    setErrors((prev) => ({ ...prev, content: undefined, submit: undefined }));
                  }}
                  placeholder="请描述您的建议或问题，最多 300 字"
                  className="w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-950/10 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                />
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>{remainingCount} 字剩余</span>
                </div>
                {errors.content && (
                  <div role="alert" className="text-xs text-red-600">
                    {errors.content}
                  </div>
                )}
              </div>

              {errors.submit && (
                <div role="alert" className="text-xs text-red-600">
                  {errors.submit}
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "提交中…" : "提交"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastVisible && (
        <div className="fixed bottom-[calc(24px+env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 rounded-full bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg shadow-zinc-900/20">
          感谢您的反馈！
        </div>
      )}
    </>
  );
}
