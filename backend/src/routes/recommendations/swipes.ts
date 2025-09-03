// src/routes/swipes.ts
import { Router, Request, Response } from "express";
import prisma from "../../lib/prisma"; // default export only
import { maybeUpdateUserLyricalTaste } from "../../workers/lyricalTasteWorker"; // <-- ADD

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

// Optional: liked tracks shortcut (?username=...&limit=100)
router.get("/liked", async (req: Request, res: Response): Promise<void> => {
  try {
    const username = String(req.query.username || "");
    if (!username) {
      res.status(400).json({ error: "Missing 'username' query param." });
      return;
    }
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    const liked = await prisma.swipe.findMany({
      where: { userId: user.id, direction: "RIGHT" },
      orderBy: { createdAt: "desc" },
      include: { track: true },
      take: Math.min(Math.max(parseInt(String(req.query.limit || "100"), 10) || 100, 1), 500),
    });
    res.json({ ok: true, liked });
  } catch (err) {
    console.error("[GET /api/swipes/liked] error:", err);
    res.status(500).json({ error: "Failed to fetch liked tracks." });
  }
});

export default router;
