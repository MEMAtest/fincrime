export const GROQ_API_URL = (process.env.GROQ_API_URL ?? "https://api.groq.com/openai/v1").trim();
export const GROQ_API_KEY = (process.env.GROQ_API_KEY || "").trim() || undefined;
export const GROQ_MODEL = (process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile").trim();

export async function generateNarrative(
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  if (!GROQ_API_KEY) return null;

  try {
    const response = await fetch(`${GROQ_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.3,
        max_tokens: 600,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      console.error("Groq API error:", response.status);
      return null;
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === "string" ? text.trim() : null;
  } catch (error) {
    console.error("Groq API request failed:", error);
    return null;
  }
}
