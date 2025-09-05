// backend/src/routes/taste.ts
import { Router, type Request, type Response, type NextFunction } from "express";
import prisma from "../lib/prisma";

const router = Router();

router.get("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const username = String(req.query.username ?? "");
    if (!username) {
      res.status(400).json({ error: "missing_username" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }

    const taste = await prisma.userLyricalTaste.findUnique({
      where: { userId: user.id },
      select: {
        assessment: true,        // <- paragraph text you wrote
        sampleSize: true,
        topThemesJSON: true,     // <- JSON string of string[]
        dominantMood: true,
        dominantStyle: true,
        grandStyle: true,
        grandStyleAvg: true,     // 0..100
        langPrefsJSON: true,     // <- JSON string of [{lang,share}]
        updatedAt: true,
      },
    });

    if (!taste) {
      res.json({ assessment: null });
      return;
    }

    // Parse JSON-string columns safely
    const topThemes = safeParseArrayString(taste.topThemesJSON);
    const langPrefs = safeParseLangPrefs(taste.langPrefsJSON);

    // Map to the frontend-friendly shape (keeps "paragraph" name)
    res.json({
      assessment: {
        paragraph: taste.assessment ?? "",
        sampleSize: taste.sampleSize ?? 0,
        topThemes,
        dominantMood: taste.dominantMood ?? null,
        dominantStyle: taste.dominantStyle ?? null,
        grandStyle: taste.grandStyle ?? null,
        grandAvg: taste.grandStyleAvg ?? null,
        langPrefs,
        createdAt: taste.updatedAt.toISOString(), // reuse updatedAt for “last updated”
      },
    });
  } catch (err) {
    next(err);
  }
});

// helpers
function safeParseArrayString(s?: string | null): string[] {
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

function safeParseLangPrefs(s?: string | null): Array<{ lang: string; share: number }> {
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x: any) => ({
        lang: typeof x?.lang === "string" ? x.lang : "",
        share: typeof x?.share === "number" ? x.share : 0,
      }))
      .filter(x => x.lang);
  } catch {
    return [];
  }
}

export default router;
