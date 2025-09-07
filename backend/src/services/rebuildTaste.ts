// backend/src/services/rebuildTaste.ts
import prisma from "../lib/prisma";
import { writeUserAssessment } from "./openai/assessmentWriter"

type LangPref = { lang: string; share: number };

export async function rebuildUserLyricalTaste(userId: number) {
  // 1) Find active likes (latest swipe per track is RIGHT)
  const swipes = await prisma.swipe.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { trackId: true, direction: true },
  });

  const latestDir = new Map<string, "LEFT" | "RIGHT">();
  for (const s of swipes) {
    if (!latestDir.has(s.trackId)) latestDir.set(s.trackId, s.direction);
  }
  const activeTrackIds = [...latestDir.entries()]
    .filter(([, dir]) => dir === "RIGHT")
    .map(([tid]) => tid);

  // Early exit: no likes
  if (activeTrackIds.length === 0) {
    await prisma.userLyricalTaste.upsert({
      where: { userId },
      create: {
        userId,
        assessment: "",
        sampleSize: 0,
        topThemesJSON: "[]",
        dominantMood: null,
        dominantStyle: null,
        grandStyle: null,
        grandStyleAvg: null,
        langPrefsJSON: "[]",
      },
      update: {
        assessment: "",
        sampleSize: 0,
        topThemesJSON: "[]",
        dominantMood: null,
        dominantStyle: null,
        grandStyle: null,
        grandStyleAvg: null,
        langPrefsJSON: "[]",
        updatedAt: new Date(),
      },
    });
    return;
  }

  // 2) Pull LyricalFeature rows for those tracks
  const feats = await prisma.lyricalFeature.findMany({
    where: { userId, trackId: { in: activeTrackIds } },
    select: {
      lyricalThemes: true,
      lyricalMood: true,
      lyricalStyle: true,
      lyricalGrand: true,
      lyricalGrandPres: true,
      lyricalLang: true,
    },
  });

  const sampleSize = feats.length;

  // 3) Aggregate
  const themesCount = new Map<string, number>();
  const moodCount = new Map<string, number>();
  const styleCount = new Map<string, number>();
  const grandCount = new Map<string, number>();
  let grandSum = 0;
  let grandSeen = 0;
  const langCount = new Map<string, number>();

  for (const f of feats) {
    // themes: JSON string of string[] in your schema
    if (f.lyricalThemes) {
      try {
        const arr: string[] = JSON.parse(f.lyricalThemes);
        for (const t of arr) {
          const key = String(t || "").toLowerCase().trim();
          if (!key) continue;
          themesCount.set(key, (themesCount.get(key) ?? 0) + 1);
        }
      } catch { /* ignore */ }
    }

    if (f.lyricalMood) {
      const key = f.lyricalMood.toLowerCase();
      moodCount.set(key, (moodCount.get(key) ?? 0) + 1);
    }
    if (f.lyricalStyle) {
      const key = f.lyricalStyle.toLowerCase();
      styleCount.set(key, (styleCount.get(key) ?? 0) + 1);
    }
    if (f.lyricalGrand) {
      const key = f.lyricalGrand;
      grandCount.set(key, (grandCount.get(key) ?? 0) + 1);
    }
    if (typeof f.lyricalGrandPres === "number") {
      grandSum += f.lyricalGrandPres;
      grandSeen += 1;
    }
    if (f.lyricalLang) {
      const key = f.lyricalLang.toLowerCase();
      langCount.set(key, (langCount.get(key) ?? 0) + 1);
    }
  }

  const topThemes = [...themesCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k]) => k);

  const pickMode = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const dominantMood = pickMode(moodCount);
  const dominantStyle = pickMode(styleCount);
  const grandStyle = pickMode(grandCount);
  const grandStyleAvg = grandSeen ? Math.round(grandSum / grandSeen) : null;

  const langPrefs: LangPref[] = (() => {
    const total = [...langCount.values()].reduce((s, n) => s + n, 0) || 1;
    return [...langCount.entries()]
      .map(([lang, cnt]) => ({ lang, share: Number((cnt / total).toFixed(3)) }))
      .sort((a, b) => b.share - a.share)
      .slice(0, 5);
  })();

  // ✦ Get username for the assessment input
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });
  const username = user?.username ?? `user_${userId}`;

  // ✦ Generate (or refresh) the paragraph with your helper
  let paragraph = "";
  try {
    paragraph = await writeUserAssessment({
      username,
      sampleSize,
      topThemes,
      dominantMood: dominantMood ?? undefined,
      dominantStyle: dominantStyle ?? undefined,
      grandStyle: grandStyle ?? undefined,
      grandStyleAvg: grandStyleAvg ?? undefined,
      langPrefs,
    });
  } catch (e) {
    console.warn("[assessmentWriter] failed, keeping prior paragraph if any:", e);
    // If you want to preserve the previous paragraph when OpenAI fails:
    const prev = await prisma.userLyricalTaste.findUnique({
      where: { userId },
      select: { assessment: true },
    });
    paragraph = prev?.assessment ?? "";
  }

  // ✦ Upsert the snapshot (same as before, now with new paragraph)
  await prisma.userLyricalTaste.upsert({
    where: { userId },
    create: {
      userId,
      assessment: paragraph,
      sampleSize,
      topThemesJSON: JSON.stringify(topThemes),
      dominantMood,
      dominantStyle,
      grandStyle,
      grandStyleAvg,
      langPrefsJSON: JSON.stringify(langPrefs),
    },
    update: {
      assessment: paragraph,
      sampleSize,
      topThemesJSON: JSON.stringify(topThemes),
      dominantMood,
      dominantStyle,
      grandStyle,
      grandStyleAvg,
      langPrefsJSON: JSON.stringify(langPrefs),
      updatedAt: new Date(),
    },
  });
}
