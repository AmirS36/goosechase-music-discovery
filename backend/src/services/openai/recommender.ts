import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export type RecommenderOpts = { moodHint?: string };
export type LikeItem = { title: string; artist: string };
export type TasteSnapshot = {
  topThemes?: string[];
  dominantMood?: string | null;
  dominantStyle?: string | null;
  grandStyle?: string | null;
  grandStyleAvg?: number | null;
  langPrefs?: Array<{ lang: string; share: number }>;
};

export type AIRecommendedSong = {
  title: string;
  artist: string;
  MIL: string; // Most Important Lyric (short quote)
  MIL_EXP: string; // Brief explanation (why this lyric matters / fits user)
};


// cross-genre starter pack
export async function recommendStarterPackByOpenAI(limit = 10) {
  const n = Math.max(1, Math.min(limit, 20));
  
  const system = `
  You are a music recommendation engine. The user has NO history yet.
  Create a welcoming starter pack of real, existing songs across DISTINCT genres and regions.
  Aim for breadth (e.g., pop, hip-hop/rap, R&B/soul, indie/alt, electronic/dance, rock/metal, jazz/funk, classical/neo-classical,
  Latin/reggaeton/afrobeats, K-pop/J-pop, folk/country, Middle-Eastern/Israeli).
  Mix eras (mostly modern, a few classics). Prefer tracks that typically have Spotify previews.
Avoid novelty/overly obscure picks; choose representative, high-quality songs.
Return STRICT JSON ONLY:

- "title": string
- "artist": string
- "MIL": string (the most important lyric line/short excerpt; 6–20 words; no ellipses if possible)
- "MIL_EXP": string (1–2 sentences explaining why this lyric matters and why it matches the user's taste)

Constraints:
- Return EXACTLY ${limit} items.
- Use strict JSON: {"songs":[{...},{...}]}. No commentary, no Markdown.
- Keep MIL <= 140 chars, MIL_EXP <= 300 chars.
- Prefer official lyric lines if you recall them; if unsure, provide a concise, faithful paraphrase in quotes and note "paraphrase" in MIL_EXP.
- Avoid duplicates and meme/joke entries.
`.trim();

  const user = JSON.stringify({ limit: n });
  
  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = resp.choices[0]?.message?.content || "{}";
  let parsed: any = {};
  try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  
  const songs: Array<{ title: string; artist: string }> = Array.isArray(parsed?.songs)
    ? parsed.songs
    : [];

  const norm = (s: string) => (s || "").trim();
  return songs
    .map(s => ({ title: norm(s.title), artist: norm(s.artist) }))
    .filter(s => s.title && s.artist)
    .slice(0, n);
  }

  
export async function recommendSongsByOpenAI(input: {
  likes: LikeItem[];
  taste?: TasteSnapshot;
  limit?: number;
  moodHint?: string; 
}): Promise<AIRecommendedSong[]> {
  const limit = Math.max(1, Math.min(input.limit ?? 10, 20));

  const system = `
You are a music recommendation engine. Given liked songs (title + artist) and an optional taste summary,
recommend real, existing songs that match the user's lyrical/mood/style vibe.
${input.moodHint ? `Weather hint: Favor a "${input.moodHint}" vibe in your picks.` : ""}
For EACH song, include:
- "title": string
- "artist": string
- "MIL": string (the most important lyric line/short excerpt; 6–20 words; no ellipses if possible)
- "MIL_EXP": string (1–2 sentences explaining why this lyric matters and why it matches the user's taste)

Constraints:
- Return EXACTLY ${limit} items.
- Use strict JSON: {"songs":[{...},{...}]}. No commentary, no Markdown.
- Keep MIL <= 140 chars, MIL_EXP <= 300 chars.
- Prefer official lyric lines if you recall them; if unsure, provide a concise, faithful paraphrase in quotes and note "paraphrase" in MIL_EXP.
- Avoid duplicates and meme/joke entries.
`.trim();

  const userPayload = {
    likes: input.likes.slice(0, 50), // cap context
    taste: input.taste ?? {},
    limit,
  };

  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.6,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(userPayload) },
    ],
  });

  const raw = resp.choices[0]?.message?.content || "{}";
   let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { songs: [] };
  }
  const songs = Array.isArray(parsed.songs) ? parsed.songs : [];
  // Light validation/coercion
  return songs.slice(0, limit).map((s: any) => ({
    title: String(s.title ?? "").trim(),
    artist: String(s.artist ?? "").trim(),
    MIL: String(s.MIL ?? "").trim(),
    MIL_EXP: String(s.MIL_EXP ?? "").trim(),
  }));
}

