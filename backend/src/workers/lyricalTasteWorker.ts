import prisma from "../lib/prisma";
import {
  analyzeTracksLyricallyBatch,
  OpenAIQuotaError,
  TrackInput,
} from "../services/openai/lyricAnalyzer";
import { writeUserAssessment } from "../services/openai/assessmentWriter";

const CHUNK_SIZE = 5;

function countMap(arr: string[]) {
  return arr.reduce<Record<string, number>>((acc, x) => {
    const k = (x || "").trim();
    if (!k) return acc;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}

function safeParseThemes(s?: string | null): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map((x) => String(x || "").toLowerCase()) : [];
  } catch {
    return [];
  }
}

function aggregateFeatures(rows: Array<{
  lyricalThemes: string | null;
  lyricalMood: string | null;
  lyricalStyle: string | null;
  lyricalGrand: string | null;
  lyricalGrandPres: number | null;
  lyricalLang: string | null;
}>) {
  const themes = rows.flatMap((r) => safeParseThemes(r.lyricalThemes));
  const themesCounts = countMap(themes);
  const topThemes = Object.entries(themesCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k]) => k);

  const moodCounts = countMap(rows.map((r) => (r.lyricalMood || "").toLowerCase()));
  const styleCounts = countMap(rows.map((r) => (r.lyricalStyle || "").toLowerCase()));
  const grandCounts = countMap(rows.map((r) => (r.lyricalGrand || "").trim()));

  const pickTop = (m: Record<string, number>) =>
    Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0];

  const grandVals = rows
    .map((r) => (typeof r.lyricalGrandPres === "number" ? r.lyricalGrandPres : null))
    .filter((x): x is number => x !== null);
  const grandAvg = grandVals.length
    ? Math.round((grandVals.reduce((a, b) => a + b, 0) / grandVals.length) * 10) / 10
    : null;

  const langCounts = countMap(rows.map((r) => (r.lyricalLang || "xx").toLowerCase()));
  const totalLang = Object.values(langCounts).reduce((a, b) => a + b, 0) || 1;
  const langPrefs = Object.entries(langCounts)
    .map(([lang, cnt]) => ({ lang, share: (cnt / totalLang) * 100 }))
    .sort((a, b) => b.share - a.share);

  return {
    sampleSize: rows.length,
    topThemes,
    dominantMood: pickTop(moodCounts) || null,
    dominantStyle: pickTop(styleCounts) || null,
    grandStyle: pickTop(grandCounts) || null,
    grandAvg,
    langPrefs,
  };
}

export async function maybeUpdateUserLyricalTaste(userId: number) {
  // Ensure progress row exists
  const progress = await prisma.tasteProgress.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  // ------------------------------------------------------------------------
  // 1) FEATURE EXTRACTION: only when we have >= CHUNK_SIZE new RIGHT swipes
  // ------------------------------------------------------------------------
  const newRightSwipes = await prisma.swipe.findMany({
    where: {
      userId,
      direction: "RIGHT",
      id: progress.lastProcessedSwipeId ? { gt: progress.lastProcessedSwipeId } : undefined,
    },
    orderBy: { id: "asc" },
    include: { track: true },
  });

  let processedGroups = 0;

  if (newRightSwipes.length >= CHUNK_SIZE) {
    for (let i = 0; i + CHUNK_SIZE <= newRightSwipes.length; i += CHUNK_SIZE) {
      const group = newRightSwipes.slice(i, i + CHUNK_SIZE); // exactly 5
      const trackInputs: TrackInput[] = group.map((s) => ({
        trackId: s.trackId,
        title: s.track!.title,
        artist: s.track!.artist,
      }));

      try {
        const batch = await analyzeTracksLyricallyBatch(trackInputs);

        // Commit features + advance cursor atomically
        const newestIdInGroup = group[group.length - 1]!.id;

        await prisma.$transaction([
          ...group.map((s) => {
            const f = batch[s.trackId];
            return prisma.lyricalFeature.upsert({
              where: { userId_trackId: { userId, trackId: s.trackId } },
              create: {
                userId,
                trackId: s.trackId,
                lyricalThemes: JSON.stringify(f?.lyricalThemes ?? []),
                lyricalMood: f?.lyricalMood ?? null,
                lyricalStyle: f?.lyricalStyle ?? null,
                lyricalGrand: f?.lyricalGrand ?? null,
                lyricalGrandPres: f?.lyricalGrandPres ?? null,
                lyricalLang: f?.lyricalLang ?? null,
              },
              update: {
                lyricalThemes: JSON.stringify(f?.lyricalThemes ?? []),
                lyricalMood: f?.lyricalMood ?? null,
                lyricalStyle: f?.lyricalStyle ?? null,
                lyricalGrand: f?.lyricalGrand ?? null,
                lyricalGrandPres: f?.lyricalGrandPres ?? null,
                lyricalLang: f?.lyricalLang ?? null,
              },
            });
          }),
          prisma.tasteProgress.update({
            where: { userId },
            data: { lastProcessedSwipeId: newestIdInGroup, lastProcessedAt: new Date() },
          }),
        ]);

        processedGroups += 1;
      } catch (e: any) {
        if (e instanceof OpenAIQuotaError) {
          console.error(`[lyricalTaste] quota hit; stopping after ${processedGroups} groups`);
          break; // do not advance cursor; will retry later
        }
        console.error("[lyricalTaste] group processing failed; stopping:", e);
        break; // do not advance cursor
      }
    }
  }

  // ------------------------------------------------------------------------
  // 2) SNAPSHOT (ROLLUP): ALWAYS recompute using last-swipe-wins
  //    This makes dislikes immediately reflected in Home.
  // ------------------------------------------------------------------------
  const swipes = await prisma.swipe.findMany({
    where: { userId },
    include: { track: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  // Last-swipe-wins per track
  const finalByTrack = new Map<string, "RIGHT" | "LEFT">();
  for (const s of swipes) {
    if (!s.trackId || finalByTrack.has(s.trackId)) continue;
    finalByTrack.set(s.trackId, s.direction);
  }
  const likedTrackIds = [...finalByTrack.entries()]
    .filter(([, dir]) => dir === "RIGHT")
    .map(([tid]) => tid);

  if (likedTrackIds.length === 0) {
    // Clear snapshot if nothing currently liked
    await prisma.userLyricalTaste.upsert({
      where: { userId },
      create: {
        userId,
        topThemesJSON: "[]",
        dominantMood: null,
        dominantStyle: null,
        grandStyle: null,
        grandStyleAvg: null,
        langPrefsJSON: "[]",
        sampleSize: 0,
        assessment: null,
      },
      update: {
        topThemesJSON: "[]",
        dominantMood: null,
        dominantStyle: null,
        grandStyle: null,
        grandStyleAvg: null,
        langPrefsJSON: "[]",
        sampleSize: 0,
        assessment: null,
        updatedAt: new Date(),
      },
    });
    return { updated: processedGroups > 0, processedGroups, message: "Snapshot cleared" };
  }

  // Use features ONLY for the tracks that are currently liked
  const features = await prisma.lyricalFeature.findMany({
    where: { userId, trackId: { in: likedTrackIds } },
    select: {
      lyricalThemes: true,
      lyricalMood: true,
      lyricalStyle: true,
      lyricalGrand: true,
      lyricalGrandPres: true,
      lyricalLang: true,
    },
  });

  const agg = aggregateFeatures(features);

  // If you want to save tokens, you can skip OpenAI when sampleSize===0 (not our case here)
  const username =
    (await prisma.user.findUnique({ where: { id: userId }, select: { username: true } }))
      ?.username ?? `user-${userId}`;

  const paragraph = await writeUserAssessment({
    username,
    sampleSize: agg.sampleSize,
    topThemes: agg.topThemes,
    dominantMood: agg.dominantMood || undefined,
    dominantStyle: agg.dominantStyle || undefined,
    grandStyle: agg.grandStyle || undefined,
    grandStyleAvg: agg.grandAvg || undefined,
    langPrefs: agg.langPrefs || [],
  });

  await prisma.userLyricalTaste.upsert({
    where: { userId },
    create: {
      userId,
      topThemesJSON: JSON.stringify(agg.topThemes),
      dominantMood: agg.dominantMood,
      dominantStyle: agg.dominantStyle,
      grandStyle: agg.grandStyle,
      grandStyleAvg: agg.grandAvg,
      langPrefsJSON: JSON.stringify(agg.langPrefs),
      sampleSize: agg.sampleSize,
      assessment: paragraph || null,
    },
    update: {
      topThemesJSON: JSON.stringify(agg.topThemes),
      dominantMood: agg.dominantMood,
      dominantStyle: agg.dominantStyle,
      grandStyle: agg.grandStyle,
      grandStyleAvg: agg.grandAvg,
      langPrefsJSON: JSON.stringify(agg.langPrefs),
      sampleSize: agg.sampleSize,
      assessment: paragraph || null,
      updatedAt: new Date(),
    },
  });

  return { updated: true, processedGroups };
}
