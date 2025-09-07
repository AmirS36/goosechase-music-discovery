import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export type LikeItem = { title: string; artist: string };
export type TasteSnapshot = {
  topThemes?: string[];
  dominantMood?: string | null;
  dominantStyle?: string | null;
  grandStyle?: string | null;
  grandStyleAvg?: number | null;
  langPrefs?: Array<{ lang: string; share: number }>;
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

{"songs":[{"title":"...","artist":"..."}, ...]}

No commentary, no extra fields, no duplicates.
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
}) {
  const limit = Math.max(1, Math.min(input.limit ?? 10, 20));

  const system = `
You are a music recommendation engine. Given a user's liked songs (title + artist) and an optional taste summary,
recommend real, existing songs that match the user's lyrical/mood/style vibe.
Return diverse but coherent picks (newer + a few classics ok). Avoid duplicates and avoid anything already in the likes.
Output STRICT JSON with this exact schema:

{"songs":[{"title":"...","artist":"..."}, ...]}

No commentary, no extra keys. Always real songs by real artists. Use global availability when possible.
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
  let parsed: any = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  const songs: Array<{ title: string; artist: string }> = Array.isArray(parsed?.songs)
    ? parsed.songs
    : [];

  // normalize + trim
  const norm = (s: string) => s?.trim();
  const cleaned = songs
    .map((s) => ({ title: norm(s.title || ""), artist: norm(s.artist || "") }))
    .filter((s) => s.title && s.artist);

  return cleaned.slice(0, limit);
}
