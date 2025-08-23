import express from 'express';
import dotenv from 'dotenv';
import querystring from 'querystring';
import fetch from 'node-fetch'; // Node 18+ has global fetch
import prisma from "../lib/prisma";

dotenv.config();
const router = express.Router();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI!;
const TOKEN_URL = "https://accounts.spotify.com/api/token";

/* ----------------------------- Helpers ----------------------------- */
function basicAuth() {
  return "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
}

// Tighten expiry with small buffer (e.g., 120s) to avoid edge 401s
function computeExpiryDate(expiresInSec?: number, bufferSec = 120): Date {
  const sec = typeof expiresInSec === "number" ? expiresInSec : 3600;
  return new Date(Date.now() + Math.max(sec - bufferSec, 0) * 1000);
}

/* ------------------------ Step 1: Redirect ------------------------- */
router.get('/spotify', (req, res) => {
  const scope = [
    "user-read-email",
    "user-read-private",
    "user-top-read",
    "user-read-recently-played",
    "user-library-read"
  ].join(' ');

  const username = (req.query.username as string) || "";

  const queryParams = querystring.stringify({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope,
    redirect_uri: REDIRECT_URI,
    state: username,   // you could sign/validate this for CSRF protection
    show_dialog: "true",
  });

  res.redirect(`https://accounts.spotify.com/authorize?${queryParams}`);
});

/* ------------------ Step 2: Callback & Exchange -------------------- */
router.get('/spotify/callback', async (req, res) => {
  try {
    const code = req.query.code as string;
    const username = req.query.state as string; // validate this if possible

    if (!code || !username) {
      return res.redirect('http://localhost:5173/settings?auth=failure');
    }

    // Exchange code for tokens
    const tokenResp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': basicAuth(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: querystring.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI
      })
    });

    if (!tokenResp.ok) {
      const errText = await tokenResp.text().catch(() => "");
      console.error("Token exchange failed:", tokenResp.status, errText);
      return res.redirect('http://localhost:5173/settings?auth=failure');
    }

    const tokenData: {
      access_token: string;
      token_type: string;       // "Bearer"
      scope?: string;           // space-separated
      expires_in: number;       // seconds (≈ 3600)
      refresh_token?: string;   // may be missing on subsequent logins
    } = await tokenResp.json();

    if (!tokenData.access_token) {
      return res.redirect('http://localhost:5173/settings?auth=failure');
    }

    // Fetch Spotify profile (v1/me)
    const profileResp = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    if (!profileResp.ok) {
      const errText = await profileResp.text().catch(() => "");
      console.error("Fetch /me failed:", profileResp.status, errText);
      return res.redirect('http://localhost:5173/settings?auth=failure');
    }
    const userProfile: any = await profileResp.json();

    // Compute expiry as DateTime (with buffer)
    const expiresAt = computeExpiryDate(tokenData.expires_in, 120);

    // Update your user. Only overwrite refresh token if Spotify returned a new one.
    const updateData: any = {
      spotifyId:           userProfile.id,
      spotifyDisplayName:  userProfile.display_name ?? null,
      spotifyImageUrl:     userProfile.images?.[0]?.url ?? null,
      spotifyAccessToken:  tokenData.access_token,
      spotifyTokenType:    tokenData.token_type ?? "Bearer",
      spotifyScope:        tokenData.scope ?? null,
      spotifyTokenExpiresAt: expiresAt,
      spotifyLinkedAt:     new Date(),
      updatedAt:           new Date(),
    };
    if (tokenData.refresh_token) {
      updateData.spotifyRefreshToken = tokenData.refresh_token;
    }

    // Ensure the user exists, then update
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      // if your flow guarantees user exists already, you can throw instead
      await prisma.user.create({
        data: {
          username,
          password: "", // or some placeholder if you require; adjust to your app’s logic
          ...updateData,
        }
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }

    console.log("🎧 Linked Spotify for:", username, "as", userProfile.id);

    const displayName = encodeURIComponent(userProfile.display_name || '');
    res.redirect(`http://localhost:5173/settings?auth=success&user=${displayName}`);
  } catch (err) {
    console.error("Callback error:", err);
    res.redirect('http://localhost:5173/settings?auth=failure');
  }
});

/* -------------------- Refresh + Ensure Fresh ------------------------ */
export async function refreshAccessToken(refreshToken: string) {
  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Spotify refresh failed: ${resp.status} ${text}`);
  }

  const data = await resp.json() as {
    access_token: string;
    expires_in: number;          // ~3600
    refresh_token?: string;      // may be returned or not
    scope?: string;
    token_type?: string;
  };

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in ?? 3600,
    refreshToken: data.refresh_token, // may be undefined
    tokenType: data.token_type ?? "Bearer",
    scope: data.scope,
  };
}

// IMPORTANT: spotifyTokenExpiresAt is DateTime in your schema
export async function ensureFreshSpotifyToken(user: {
  id: number;
  spotifyAccessToken: string | null;
  spotifyRefreshToken: string | null;
  spotifyTokenExpiresAt: Date | null; // DateTime now
  spotifyTokenType?: string | null;
  spotifyScope?: string | null;
}): Promise<string> {
  if (!user.spotifyRefreshToken) {
    throw new Error("No refresh token; user must re-connect Spotify.");
  }

  const bufferMs = 120 * 1000; // 2 min
  const notExpired =
    user.spotifyAccessToken &&
    user.spotifyTokenExpiresAt instanceof Date &&
    user.spotifyTokenExpiresAt.getTime() - Date.now() > bufferMs;

  if (notExpired) return user.spotifyAccessToken as string;

  const result = await refreshAccessToken(user.spotifyRefreshToken);
  const newAccess  = result.accessToken;
  const newRefresh = result.refreshToken ?? user.spotifyRefreshToken;
  const newExpires = computeExpiryDate(result.expiresIn, 120);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      spotifyAccessToken:    newAccess,
      spotifyRefreshToken:   newRefresh,
      spotifyTokenExpiresAt: newExpires,
      ...(result.tokenType ? { spotifyTokenType: result.tokenType } : {}),
      ...(result.scope ? { spotifyScope: result.scope } : {}),
      updatedAt: new Date(),
    },
  });

  return newAccess;
}

export default router;
