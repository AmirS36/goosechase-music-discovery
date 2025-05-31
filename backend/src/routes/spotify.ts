import express from 'express';
import dotenv from 'dotenv';
import querystring from 'querystring';
import fetch from 'node-fetch'; // If using Node 16; skip if on Node 18+

dotenv.config();
const router = express.Router();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI!;

// Step 1: Redirect to Spotify login
router.get('/spotify', (req, res) => {
  const scope = [
    "user-read-email",
    "user-read-private",
    "user-top-read",
    "user-read-recently-played"
  ].join(' ');

  const queryParams = querystring.stringify({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope,
    redirect_uri: REDIRECT_URI
  });

  res.redirect(`https://accounts.spotify.com/authorize?${queryParams}`);
});

// Step 2: Handle callback and exchange code for tokens
router.get('/spotify/callback', async (req, res) => {
  const code = req.query.code as string;

  const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: querystring.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI
    })
  });

  const tokenData  = await tokenResponse.json();

  if (!tokenData.access_token) {
    return res.redirect('http://localhost:5173/settings?auth=failure');
  }

  // ✅ Step: Fetch user profile from Spotify using access token
  const userProfileResponse = await fetch('https://api.spotify.com/v1/me', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`
    }
  });

  const userProfile = await userProfileResponse.json();

  // 🧪 Log it or send it as query param for now (basic test)
  console.log("🎧 Logged-in Spotify user:", userProfile);

  // ✅ Redirect back to frontend (add user ID or display name if you want)
  const displayName = encodeURIComponent(userProfile.display_name || '');
  res.redirect(`http://localhost:5173/settings?auth=success&user=${displayName}`);
});

export default router;
