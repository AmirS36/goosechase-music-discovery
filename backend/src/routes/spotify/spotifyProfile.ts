// routes/spotifyProfile.ts
import { Router, Request, Response } from 'express';
import prisma from '../../lib/prisma';

const router = Router();

router.get('/:username', async (req: Request, res: Response) => {
  const { username } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        spotifyDisplayName: true,
        spotifyId: true,
        spotifyAccessToken: true,
        spotifyTokenExpiresAt: true,
        spotifyRefreshToken: true,
        spotifyImageUrl: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // If all Spotify fields are null, treat as not connected
    const allNull =
      !user.spotifyDisplayName &&
      !user.spotifyId &&
      !user.spotifyAccessToken &&
      !user.spotifyTokenExpiresAt &&
      !user.spotifyRefreshToken &&
      !user.spotifyImageUrl;

    if (allNull) {
      res.status(204).send(); // No Content, means not connected
      return;
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
