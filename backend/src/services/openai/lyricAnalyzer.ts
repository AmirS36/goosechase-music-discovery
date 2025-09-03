import OpenAI, { APIError } from "openai";

export class OpenAIQuotaError extends Error {}
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

type ChatJSON = { type: "json_object" };

export type LyricalExtraction = {
  lyricalThemes: string[];
  lyricalMood: string;
  lyricalStyle: string;
  lyricalGrand: string;
  lyricalGrandPres: number;
  lyricalLang: string;
};

export type TrackInput = {
  trackId: string; // Spotify ID (22 chars)
  title: string;
  artist: string;
  snippet?: string;
  languageHint?: string;
};

// simple retry/backoff for transient 429/5xx (NOT for insufficient_quota)
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let delay = 500;
  for (let i = 0; i < 3; i++) {
    try { return await fn(); }
    catch (e: any) {
      if (e instanceof APIError) {
        if (e.code === "insufficient_quota") throw new OpenAIQuotaError(e.message);
        if (e.status === 429 || e.status >= 500) {
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
          continue;
        }
      }
      throw e;
    }
  }
  return await fn();
}

/**
 * EXACTLY ONE OpenAI call that analyzes up to 5 tracks at once.
 * Returns a map keyed by trackId.
 */
export async function analyzeTracksLyricallyBatch(
  inputs: TrackInput[]
): Promise<Record<string, LyricalExtraction>> {
  if (!inputs.length) return {};

  const system = `You extract lyrical attributes for songs and return STRICT JSON.
Return ONE JSON object where each key is the trackId and value is:
{
  "lyricalThemes": string[],       // e.g. ["love","nostalgia"]
  "lyricalMood": string,           // e.g. "happy","sad",...
  "lyricalStyle": string,          // "simple"|"metaphorical"|...
  "lyricalGrand": string,          // "Simple"|"Elevated"
  "lyricalGrandPres": number,      // integer 0..100
  "lyricalLang": string            // ISO-639-1 like "en","he"
}
Only those keys. No commentary.`;

  const user = inputs.map((t, i) => {
    const lines = [
      `#${i + 1}`,
      `trackId: ${t.trackId}`,
      `title: ${t.title}`,
      `artist: ${t.artist}`,
      t.snippet ? `lyrics_snippet: ${t.snippet}` : null,
      t.languageHint ? `language_hint: ${t.languageHint}` : null,
    ].filter(Boolean);
    return lines.join("\n");
  }).join("\n\n");

  const resp = await withRetry(() => client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    temperature: 0.2,
    response_format: { type: "json_object" } as ChatJSON
  }));

  const raw = resp.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as Record<string, any>;

  // normalize
  const out: Record<string, LyricalExtraction> = {};
  for (const [trackId, v] of Object.entries(parsed)) {
    out[trackId] = {
      lyricalThemes: (v?.lyricalThemes ?? []).map((s: any) => String(s).toLowerCase()),
      lyricalMood: String(v?.lyricalMood ?? ""),
      lyricalStyle: String(v?.lyricalStyle ?? ""),
      lyricalGrand: String(v?.lyricalGrand ?? ""),
      lyricalGrandPres: Math.max(0, Math.min(100, Number(v?.lyricalGrandPres ?? 0))),
      lyricalLang: String(v?.lyricalLang ?? "").slice(0, 2).toLowerCase(),
    };
  }
  return out;
}
