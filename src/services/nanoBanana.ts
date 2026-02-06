export async function generatePortrait(prompt: string): Promise<string> {
  const response = await fetch("/api/imagen", {
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

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) {
      const fallbackUrl = createPollinationsFallback(prompt);
      if (fallbackUrl) {
        return fallbackUrl;
      }
    }
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

function createPollinationsFallback(prompt: string) {
  try {
    const enhancedPrompt = `cinematic portrait of ${prompt}, high quality, 8k, photorealistic, dramatic lighting`;
    const encodedPrompt = encodeURIComponent(enhancedPrompt);
    const randomSeed = Math.floor(Math.random() * 100000);
    const timestamp = new Date().getTime();
    return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=768&height=1024&seed=${randomSeed}&model=flux&nologo=true&t=${timestamp}`;
  } catch {
    return "";
  }
}
