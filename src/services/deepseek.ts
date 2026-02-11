export async function generateQuote(name: string): Promise<string> {
  const response = await fetch("/api/deepseek", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that provides famous quotes. When a user provides a name, you should return ONE famous quote by that person. Return ONLY the quote text in the response, without any introduction or quotation marks. If the person is Chinese, return the quote in Chinese. If the person is Western, return the quote in English.",
        },
        {
          role: "user",
          content: `Please provide a famous quote by ${name}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate quote: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const quote = data.choices?.[0]?.message?.content?.trim();

  if (!quote) {
    throw new Error("No quote found in response");
  }

  return quote;
}
