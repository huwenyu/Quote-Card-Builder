export async function generatePortrait(prompt: string): Promise<string> {
  let response: Response | null = null;
  try {
    response = await fetch("/api/imagen", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio: "3:4",
          },
        },
      }),
    });
  } catch (e) {
    console.warn("Imagen API failed to fetch, trying fallback...", e);
  }

  if (!response || !response.ok) {
    const errorText = response ? await response.text() : "Network Error";
    const shouldFallback =
      !response ||
      response.status === 429 ||
      response.status === 401 ||
      response.status === 403 ||
      response.status >= 500;

    if (!shouldFallback) {
      throw new Error(`API 调用失败: ${response?.status} ${response?.statusText} ${errorText}`);
    }

    try {
      const jimengRes = await fetch("/api/jimeng", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (jimengRes.ok) {
        const jimengJson: any = await jimengRes.json();
        if (jimengJson?.image_base64) {
          return `data:image/png;base64,${jimengJson.image_base64}`;
        }
        if (jimengJson?.image_url) {
          return jimengJson.image_url;
        }
      }
    } catch {
      // ignore
    }

    const fallbackUrl = createCopilotFallback(prompt);
    if (fallbackUrl) return fallbackUrl;
    throw new Error(`API 调用失败: ${response.status} ${response.statusText} ${errorText}`);
  }

  const responseText = await response.text();
  let data: any;
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(`API 响应解析失败: ${responseText}`);
  }
  const base64Image =
    data?.candidates?.[0]?.content?.parts?.find((part: any) => part?.inlineData?.data)
      ?.inlineData?.data;

  if (!base64Image) {
    throw new Error("API 返回中未找到图片数据");
  }

  return `data:image/png;base64,${base64Image}`;
}

function createCopilotFallback(prompt: string) {
  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const timestamp = new Date().getTime();
    return `https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=${encodedPrompt}&image_size=portrait_4_3&t=${timestamp}`;
  } catch {
    return "";
  }
}
