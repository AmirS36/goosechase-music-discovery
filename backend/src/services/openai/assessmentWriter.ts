// backend/src/services/openai/assessmentWriter.ts
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function writeUserAssessment(input: {
  username: string;
  sampleSize: number;
  topThemes: string[];         // already aggregated
  dominantMood?: string;
  dominantStyle?: string;
  grandStyle?: string;
  grandStyleAvg?: number;
  langPrefs: Array<{ lang: string; share: number }>;
}) {
  const system = `You are a music curator. Write a short, friendly, concrete assessment (4–6 sentences max) of a user's lyrical music taste based on structured inputs. Avoid fluff.`;

  const user = JSON.stringify(input);

  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: 0.5
  });

  return resp.choices[0]?.message?.content?.trim() ?? "";
}
