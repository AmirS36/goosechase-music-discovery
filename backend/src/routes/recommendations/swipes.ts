// src/routes/swipes.ts
import { Router, Request, Response } from "express";
import prisma from "../../lib/prisma"; // default export only
import { maybeUpdateUserLyricalTaste } from "../../workers/lyricalTasteWorker"; // <-- ADD
import { rebuildUserLyricalTaste } from "../../services/rebuildTaste"; 

const router = Router();

type Direction = "LEFT" | "RIGHT";

type SwipeBody = {
  username: string;
  trackId?: string; // Spotify 22-char ID (preferred)
  direction: Direction | "left" | "right";
  metadata?: {
    title: string;
    artist: string;
    image_url?: string;
    preview_url?: string;
    spotify_url: string; // e.g. https://open.spotify.com/track/<id>?...
  };
  sessionId?: string;
  rank?: number;
};

function normalizeDirection(d?: SwipeBody["direction"]): Direction | null {
  const up = (d ?? "").toUpperCase();
  return up === "LEFT" || up === "RIGHT" ? (up as Direction) : null;
}

function extractSpotifyTrackId(input?: string): string {
  if (!input) return "";
  // supports: /track/{id}, /intl-xx/track/{id}, spotify:track:{id}
  const m = input.match(/spotify(?:\.com\/(?:intl-[^/]+\/)?track\/|:track:)([A-Za-z0-9]{22})/);
  return m ? m[1] : "";
}

router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as SwipeBody;

    if (!body?.username) {
      res.status(400).json({ error: "Missing 'username'." });
      return;
    }
    const direction = normalizeDirection(body.direction);
    if (!direction) {
      res.status(400).json({ error: "Invalid 'direction'. Use LEFT or RIGHT." });
      return;
    }

    let trackId = (body.trackId || "").trim();
    if (!trackId && body.metadata?.spotify_url) {
      trackId = extractSpotifyTrackId(body.metadata.spotify_url);
    }
    if (!trackId) {
      res.status(400).json({ error: "Missing 'trackId' (or a parsable metadata.spotify_url)." });
      return;
    }

    const user = await prisma.user.findUnique({ where: { username: body.username } });
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    // Upsert Track if we have metadata
    if (body.metadata?.title && body.metadata?.artist) {
      await prisma.track.upsert({
        where: { id: trackId },
        update: {
          title: body.metadata.title,
          artist: body.metadata.artist,
          imageUrl: body.metadata.image_url,
          previewUrl: body.metadata.preview_url,
          spotifyUrl: body.metadata.spotify_url,
        },
        create: {
          id: trackId,
          title: body.metadata.title,
          artist: body.metadata.artist,
          imageUrl: body.metadata.image_url,
          previewUrl: body.metadata.preview_url,
          spotifyUrl: body.metadata.spotify_url,
        },
      });
    }

    const swipe = await prisma.swipe.create({
      data: {
        userId: user.id,
        trackId,
        direction,                  // 'LEFT' | 'RIGHT' (matches your Prisma enum)
        sessionId: body.sessionId ?? null,
        rank: typeof body.rank === "number" ? body.rank : null,
      },
    });

    // --- LYRICAL TASTE HOOK (fire-and-forget) ---
    const tasteUpdateTriggered = direction === "RIGHT";
    if (tasteUpdateTriggered) {
      maybeUpdateUserLyricalTaste(user.id).catch(err =>
        console.error("[lyricalTasteWorker] failed:", err)
      );
    }
    // -------------------------------------------

    res.json({ ok: true, swipeId: swipe.id, tasteUpdateTriggered });
  } catch (err) {
    console.error("[POST /api/swipes] error:", err);
    res.status(500).json({ error: "Failed to record swipe." });
  }
});

// Optional: fetch recent swipes (supports ?username=...&direction=LEFT|RIGHT&limit=50)
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("[/api/swipes GET] query:", req.query);
    const username = String(req.query.username || "");
    if (!username) {
      res.status(400).json({ error: "Missing 'username' query param." });
      return;
    }
    const dirQ = String(req.query.direction || "").toUpperCase();
    const dir: Direction | undefined =
      dirQ === "LEFT" || dirQ === "RIGHT" ? (dirQ as Direction) : undefined;

    const take = Math.min(Math.max(parseInt(String(req.query.limit || "50"), 10) || 50, 1), 200);

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const swipes = await prisma.swipe.findMany({
      where: { userId: user.id, ...(dir ? { direction: dir } : {}) },
      orderBy: { createdAt: "desc" },
      take,
      include: { track: true },
    });

    res.json({ ok: true, swipes });
  } catch (err) {
    console.error("[GET /api/swipes] error:", err);
    res.status(500).json({ error: "Failed to fetch swipes." });
  }
});

/**
 * POST /api/swipes/unlike
 * Body: { username: string, trackId?: string, spotify_url?: string }
 */
router.post(
  "/unlike",
  async (req: Request, res: Response, next: Function): Promise<void> => {
    try {
      const { username, trackId, spotify_url } = req.body ?? {};
      if (!username) {
        res.status(400).json({ error: "Missing 'username' in body." });
        return;
      }

      const user = await prisma.user.findUnique({ where: { username } });
      if (!user) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      // Resolve trackId (prefer provided ID; else from spotify_url)
      let id = typeof trackId === "string" ? trackId.trim() : "";
      if (!id && typeof spotify_url === "string") {
        const m = spotify_url.match(/\/track\/([A-Za-z0-9]{22})/);
        if (m) id = m[1];
      }
      if (!id) {
        res.status(400).json({ error: "Missing 'trackId' or 'spotify_url'." });
        return;
      }

      // Ensure track exists (no-op if already there)
      await prisma.track.upsert({
        where: { id },
        update: {},
        create: {
          id,
          title: "Unknown title",
          artist: "Unknown artist",
          spotifyUrl: `https://open.spotify.com/track/${id}`,
        },
      });

      // Record a LEFT swipe (we keep history; latest wins)
      await prisma.swipe.create({
        data: { userId: user.id, trackId: id, direction: "LEFT" },
        select: { id: true },
      });

      // Rebuild lyrical taste from *current* likes (no new OpenAI calls)
      setImmediate(async () => {
        try {
          await rebuildUserLyricalTaste(user.id);
        } catch (e) {
          console.error("[rebuildUserLyricalTaste] failed:", e);
        }
      });

      res.json({ ok: true, trackId: id });
    } catch (err) {
      console.error("[POST /api/swipes/unlike] error:", err);
      next(err);
    }
  }
);

/**
 * GET /api/swipes/liked?username=NAME&limit=100
 * Returns current liked songs where the *latest* swipe per track is RIGHT.
 */
router.get(
  "/liked",
  async (req: Request, res: Response, next: Function): Promise<void> => {
    try {
      const username = String(req.query.username ?? "");
      if (!username) {
        res.status(400).json({ error: "Missing 'username' query param." });
        return;
      }

      const user = await prisma.user.findUnique({ where: { username } });
      if (!user) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      const limitParam = Number(req.query.limit ?? 100);
      const limit = Math.max(1, Math.min(isFinite(limitParam) ? limitParam : 100, 500));

      // Get a big enough window, newest first
      const swipes = await prisma.swipe.findMany({
        where: { userId: user.id },
        include: { track: true },
        orderBy: { createdAt: "desc" },
        take: Math.min(limit * 6, 2000),
      });

      // Latest swipe wins per track
      const latest: Record<string, typeof swipes[number]> = {};
      for (const s of swipes) {
        if (!s.track) continue;
        if (latest[s.trackId]) continue; // already have the latest one (we're iterating desc)
        latest[s.trackId] = s;
      }

      const songs = Object.values(latest)
        .filter(s => s.direction === "RIGHT" && s.track)
        .slice(0, limit)
        .map(s => ({
          id: s.trackId,
          title: s.track!.title,
          artist: s.track!.artist,
          image_url: s.track!.imageUrl,
          preview_url: s.track!.previewUrl,
          spotify_url: s.track!.spotifyUrl,
          liked_at: s.createdAt,
        }));

      res.json({ songs });
    } catch (err) {
      console.error("[GET /api/swipes/liked] error:", err);
      next(err);
    }
  }
);
export default router;
