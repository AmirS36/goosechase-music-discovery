// This code defines an Express route that interacts with a Python API to fetch song recommendations.

import express from 'express';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const pythonApiUrl = 'http://localhost:8000/recommend';

    const pythonResponse = await fetch(pythonApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        spotify_token: 'dummy',
        weather_api_key: 'dummy',
        lastfm_api_key: 'dummy',
        openai_api_key: 'dummy'
      }),
    });

    if (!pythonResponse.ok) {
      throw new Error(`Python API error: ${pythonResponse.status}`);
    }

    const data = await pythonResponse.json();

    const cleaned = data.recommendations.map((rec: any) => ({
      title: rec.title,
      artist: rec.artist,
      lyrics: rec.suggested_lyrics,
      start: rec.suggested_lyrics_start_time,
      end: rec.suggested_lyrics_end_time,
      reason: rec.reason
    }));

    res.json({ songs: cleaned });

  } catch (err) {
    console.error('Error fetching from Python module:', err);
    res.status(500).json({ error: 'Could not fetch recommendations' });
  }
});

export default router;
