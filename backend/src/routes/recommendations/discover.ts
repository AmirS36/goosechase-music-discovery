// src/routes/discover.ts
import express from "express";
import prisma from "../../lib/prisma"; // adjust path if needed
import { ensureFreshSpotifyToken } from "../spotify"; // path to your helper

const spotifyPreviewFinder = require('spotify-preview-finder');
const router = express.Router();

router.get("/", async (req, res) => {
  console.log("[/api/discover GET] query:", req.query);
  const username = req.query.username as string;

  if (!username) {
    res.status(400).json({ error: "Missing username" });
    return
  }

  try {
    // 1. Get user from DB
    const user = await prisma.user.findUnique({
      where: { username: username },
    });
    if (!user || !user.spotifyAccessToken) {
      res.status(404).json({ error: "User not found or missing token" });
      return
    }
    //const accessToken = user.spotifyAccessToken;
    // 🔑 make sure token is fresh
    const accessToken = await ensureFreshSpotifyToken(user);
    
    // 2. Call Omri's API using fetch instead of axios
    const omriRes = await fetch("http://localhost:8000/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spotify_token: accessToken,
        username, // <- use the req.query.username already validated above
      }),
    });

    if (!omriRes.ok) {
      throw new Error(`Omri's API error: ${omriRes.status}`);
    }

    const { recommendations } = await omriRes.json();
    const tracks = recommendations; // same simplified shape used later

  
    // Step 3: Enrich each track with a preview URL using spotifyPreviewFinder
    const enrichedTracks = await Promise.all(
      tracks.map(async (track: any) => {
        const query = `${track.title} - ${track.artist}`;
        try {
          const result = await spotifyPreviewFinder(query, 1);
          const previewUrl = result.success && result.results[0]?.previewUrls?.[0] || null;

          return {
            ...track,
            preview_url: previewUrl,
          };
        } catch (e) {
          console.warn(`Preview finder failed for "${query}":`, e);
          return {
            ...track,
            preview_url: null,
          };
        }
      })
    );

    console.log("songs fetched from Omri's API (with preview URL's):", enrichedTracks);

    // 4. Return the songs to the frontend
    res.json({ songs: enrichedTracks });
    return;

  } catch (error) {
    console.error("Error in /discover:", error);
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

export default router;
