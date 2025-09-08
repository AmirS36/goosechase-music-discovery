// backend/src/routes/discover.ts
import express, { Request, Response, NextFunction } from "express";
import prisma from "../../lib/prisma";
import { recommendSongsByOpenAI, recommendStarterPackByOpenAI } from "../../services/openai/recommender";


const router = express.Router();

/* ---------------- Spotify helpers (app token + search) ---------------- */

let SPOTIFY_TOKEN_CACHE: { access_token: string; expires_at: number } | null = null;

async function getSpotifyAppToken(): Promise<string | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    if (SPOTIFY_TOKEN_CACHE && SPOTIFY_TOKEN_CACHE.expires_at - 30 > now) {
      return SPOTIFY_TOKEN_CACHE.access_token;
    }
    const id = process.env.SPOTIFY_CLIENT_ID;
    const secret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!id || !secret) return null;

    const body = new URLSearchParams({ grant_type: "client_credentials" });
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) return null;
    const j = await res.json();
    SPOTIFY_TOKEN_CACHE = {
      access_token: j.access_token,
      expires_at: Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
    };
    return SPOTIFY_TOKEN_CACHE.access_token;
  } catch {
    return null;
  }
}

function norm(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, "") // drop (feat...) (remaster...)
    .replace(/\s*-\s*(remaster|radio edit|single|live).*/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}

async function resolveWithSpotify(title: string, artist: string) {
  const token = await getSpotifyAppToken();
  if (!token) return null;

  const q = encodeURIComponent(`track:${title} artist:${artist}`);
  const url = `https://api.spotify.com/v1/search?type=track&limit=5&q=${q}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  const items: any[] = j?.tracks?.items || [];
  if (items.length === 0) return null;

  // Prefer a result with preview_url AND close artist/title match
  const nt = norm(title);
  const na = norm(artist);

  const scored = items.map((t) => {
    const tTitle = norm(t?.name || "");
    const tArtists = (t?.artists || []).map((a: any) => norm(a?.name || ""));
    const titleScore = tTitle === nt ? 2 : tTitle.includes(nt) ? 1 : 0;
    const artistScore = tArtists.includes(na) ? 2 : tArtists.some((a: string) => a && na && (a.includes(na) || na.includes(a))) ? 1 : 0;
    const hasPreview = t?.preview_url ? 1 : 0;
    return { t, score: titleScore * 3 + artistScore * 3 + hasPreview };
  });

  scored.sort((a, b) => b.score - a.score);

  // Prefer the top-scored with preview_url; else just top-scored
  const withPreview = scored.find((s) => s.t?.preview_url)?.t || scored[0].t;
  const images = withPreview?.album?.images || [];
  return {
    id: withPreview?.id || null,
    title: withPreview?.name || title,
    artist: (withPreview?.artists || []).map((a: any) => a?.name).filter(Boolean).join(", ") || artist,
    preview_url: withPreview?.preview_url || null,
    image_url: images[0]?.url || null,
    spotify_url: withPreview?.external_urls?.spotify || null,
  };
}

/* ---------------- iTunes fallback (for preview/art) ---------------- */

async function resolveWithITunes(title: string, artist: string) {
  const q = encodeURIComponent(`${title} ${artist}`);
  const url = `https://itunes.apple.com/search?term=${q}&entity=song&limit=1`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  const it = j?.results?.[0];
  if (!it) return null;

  const art = typeof it.artworkUrl100 === "string"
    ? it.artworkUrl100.replace("100x100bb", "600x600bb")
    : it.artworkUrl100;

  return {
    id: String(it.trackId),
    title: it.trackName,
    artist: it.artistName,
    preview_url: it.previewUrl || null,
    image_url: art || null,
    // keep field name for UI compatibility
    spotify_url: it.trackViewUrl || it.collectionViewUrl || null,
  };
}

/* ---------------- Map Open-Meteo weather codes to simple moods ---------------- */

function weatherCodeToMood(code: number): string {
  // rain/drizzle/showers
  if ([51,53,55,61,63,65,80,81,82,66,67].includes(code)) return "melancholic, sad, chill, lo-fi, acoustic";
  // thunderstorm
  if ([95,96,99].includes(code)) return "dramatic, intense, anthemic, electronic/alt rock";
  // snow/ice
  if ([71,73,75,77,85,86].includes(code)) return "cozy, warm, intimate, acoustic, jazz";
  // clear
  if (code === 0) return "sunny, upbeat, feel-good pop, dance";
  // clouds/fog
  if ([1,2,3,45,48].includes(code)) return "mellow, indie, soft pop, ambient";
  return "balanced, versatile";
}

async function inferWeatherMoodFromQuery(req: Request): Promise<string | undefined> {
  const useWeather = String(req.query.weather || "").toLowerCase() === "true";
  if (!useWeather) return undefined;

  const lat = parseFloat(String(req.query.lat || ""));
  const lon = parseFloat(String(req.query.lon || ""));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,temperature_2m`;
  try {
    const r = await fetch(url);
    if (!r.ok) return undefined;
    const j = await r.json().catch(() => null);
    const code = j?.current?.weather_code;
    const temp = j?.current?.temperature_2m;
    if (typeof code !== "number") return undefined;

    let mood = weatherCodeToMood(code);
    if (typeof temp === "number") {
      if (temp >= 28) mood = "summer, upbeat, dance, feel-good";
      if (temp <= 10 && !mood.includes("cozy")) mood += ", cozy";
    }
    return mood;
  } catch {
    return undefined;
  }
}

/* ---------------- Route: /api/discover ---------------- */

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const username = String(req.query.username ?? "");
    if (!username) return void res.status(400).json({ error: "Missing username" });

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return void res.status(404).json({ error: "User not found" });

    // 1) recent RIGHT swipes
    const swipes = await prisma.swipe.findMany({
      where: { userId: user.id, direction: "RIGHT" },
      include: { track: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const likes = swipes
      .filter((s) => s.track)
      .map((s) => ({ title: s.track!.title, artist: s.track!.artist }));

    // 1b) Recent LEFT swipes (dislikes) -------
    const dislikedSwipes = await prisma.swipe.findMany({
      where: { userId: user.id, direction: "LEFT" },
      include: { track: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    const dislikes = dislikedSwipes
      .filter((s) => s.track)
      .map((s) => ({
        id: s.track!.id,                 // Spotify track id if you stored it
        title: s.track!.title,
        artist: s.track!.artist,
      }));


    // 2) optional taste snapshot
    const tasteRow = await prisma.userLyricalTaste.findUnique({
      where: { userId: user.id },
      select: {
        topThemesJSON: true,
        dominantMood: true,
        dominantStyle: true,
        grandStyle: true,
        grandStyleAvg: true,
        langPrefsJSON: true,
      },
    });
    const taste = tasteRow
      ? {
          topThemes: safeParseArr(tasteRow.topThemesJSON),
          dominantMood: tasteRow.dominantMood,
          dominantStyle: tasteRow.dominantStyle,
          grandStyle: tasteRow.grandStyle,
          grandStyleAvg: tasteRow.grandStyleAvg,
          langPrefs: safeParseLangPrefs(tasteRow.langPrefsJSON),
        }
      : undefined;

    // infer weather mood from ?weather=true&lat=...&lon=...
    const moodHint = await inferWeatherMoodFromQuery(req);

    // 3) ask OpenAI for suggestions
    // likes = RIGHT swipes mapped to [{title, artist}]
    let aiSongs: Array<{ title: string; artist: string ; MIL?: string; MIL_EXP?: string }> = [];
    const limit = 8;
          
    // COLD START: no history → diverse cross-genre starter pack from OpenAI
    if (likes.length === 0) {
      aiSongs = await recommendStarterPackByOpenAI(limit, { moodHint });
    } else {
      // Personalized followups guided by likes (and optional taste snapshot)
      aiSongs = await recommendSongsByOpenAI({ likes, taste, limit, moodHint });
    }

    // 4) Build liked/disliked lookup sets ---------- (NEW: include dislikes)
    const pairKey = (t: string, a: string) =>
      `${(t || "").toLowerCase().trim()}||${(a || "").toLowerCase().trim()}`;

    const likedPairs = new Set(likes.map((l) => pairKey(l.title, l.artist)));
    const dislikedPairs = new Set(dislikes.map((d) => pairKey(d.title, d.artist)));
    const dislikedIds = new Set(dislikes.map((d) => d.id).filter(Boolean));

    // Exclude anything already liked OR disliked before resolving
    const fresh = aiSongs.filter((s) => {
      const k = pairKey(s.title, s.artist);
      return !likedPairs.has(k) && !dislikedPairs.has(k);
    });

    // 5) Resolve: Spotify first (to get preview), then iTunes fallback
    const resolved = await Promise.all(
      fresh.map(async (s) => {
        const sp = await resolveWithSpotify(s.title, s.artist);
        if (sp?.preview_url) {
          return {
            ...sp,
            MIL: s.MIL, // <- pass through
            MIL_EXP: s.MIL_EXP, // <- pass through
          };
        }

        if (sp) {
          const it = await resolveWithITunes(s.title, s.artist);
          return {
            id: sp.id || it?.id || null,
            title: sp.title,
            artist: sp.artist,
            preview_url: sp.preview_url || it?.preview_url || null,
            image_url: sp.image_url || it?.image_url || null,
            spotify_url: sp.spotify_url || it?.spotify_url || null,
            MIL: s.MIL,
            MIL_EXP: s.MIL_EXP,
          };
        }

        const it = await resolveWithITunes(s.title, s.artist);
        return it
          ? {
              ...it,
              MIL: s.MIL,
              MIL_EXP: s.MIL_EXP,
            }
          : {
              id: null,
              title: s.title,
              artist: s.artist,
              preview_url: null,
              image_url: null,
              spotify_url: null,
              MIL: s.MIL,
              MIL_EXP: s.MIL_EXP,
            };
      })
    );

    // 6) NEW: Final filter against disliked (by pair AND by track id)
   const normalized = resolved.map((s: any) => ({
     id: s.id ?? null,
     title: String(s.title ?? "").trim(),
     artist: String(s.artist ?? "").trim(),
     preview_url: s.preview_url ?? null,
     image_url: s.image_url ?? null,
     spotify_url: s.spotify_url ?? null,
     MIL: String(s.MIL ?? "").trim(),
     MIL_EXP: String(s.MIL_EXP ?? "").trim(),
   }));

   const cleaned = normalized.filter((s) => s.title && s.artist);
   const songs = cleaned.slice(0, limit);

   res.json({ songs });
  } catch (err) {
    console.error("Error in /discover:", err);
    next(err);
  }
});


function safeParseArr(s?: string | null): string[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}
function safeParseLangPrefs(s?: string | null): Array<{ lang: string; share: number }> {
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x: any) => ({ lang: String(x?.lang || ""), share: Number(x?.share || 0) }))
      .filter((x) => x.lang);
  } catch { return []; }
}

export default router;
