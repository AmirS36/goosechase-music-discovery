// src/routes/discover.ts
import express from "express";
import prisma from "../../lib/prisma"; // adjust path if needed

const router = express.Router();

router.get("/", async (req, res) => {
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

    const accessToken = user.spotifyAccessToken;

    // 2. Call Omri's API using fetch instead of axios
    const omriRes = await fetch("http://localhost:8000/get-starting-songs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accessToken }),
    });

    if (!omriRes.ok) {
      throw new Error(`Omri's API error: ${omriRes.status}`);
    }

    const tracks = await omriRes.json();

    console.log("songs fetched from Omri's API:", tracks);


    // 4. Return the songs to the frontend
    res.json({ songs: tracks });
    return;

  } catch (error) {
    console.error("Error in /discover:", error);
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

export default router;
