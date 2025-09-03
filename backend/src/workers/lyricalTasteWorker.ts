import prisma from "../lib/prisma";
import { analyzeTracksLyricallyBatch, OpenAIQuotaError, TrackInput } from "../services/openai/lyricAnalyzer";
import { writeUserAssessment } from "../services/openai/assessmentWriter";

const CHUNK_SIZE = 5;

export async function maybeUpdateUserLyricalTaste(userId: number) {
  // cursor
  const progress = await prisma.tasteProgress.upsert({
    where: { userId },
    update: {},
    create: { userId }
  });

  // new RIGHT swipes after cursor
  const newSwipes = await prisma.swipe.findMany({
    where: {
      userId,
      direction: "RIGHT",
      id: progress.lastProcessedSwipeId ? { gt: progress.lastProcessedSwipeId } : undefined,
    },
    orderBy: { id: "asc" },
    include: { track: true }
  });

  if (newSwipes.length < CHUNK_SIZE) {
    return { updated: false, reason: "NOT_ENOUGH_NEW_RIGHT_SWIPES" };
  }

  // We'll build on top of current features in-memory, then commit per chunk
  let currentFeatures = await prisma.lyricalFeature.findMany({ where: { userId } });

  // helper aggregation over an array of features (in-memory)
  const aggregate = (features: typeof currentFeatures) => {
    const countMap = (arr: string[]) => arr.reduce<Record<string, number>>((acc, x) => {
      acc[x] = (acc[x] ?? 0) + 1; return acc;
    }, {});

    const allThemes = features.flatMap(f => {
      try { return (f.lyricalThemes ? JSON.parse(f.lyricalThemes) : []) as string[]; }
      catch { return [] as string[]; }
    }).map(s => s.toLowerCase());

    const themesCounts = countMap(allThemes);
    const topThemes = Object.entries(themesCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k])=>k);

    const majority = (vals: (string | null)[]) => {
      const cs = countMap(vals.filter(Boolean).map(v => v!.toLowerCase()));
      return Object.entries(cs).sort((a,b)=>b[1]-a[1])[0]?.[0];
    };

    const dominantMood  = majority(features.map(f => f.lyricalMood));
    const dominantStyle = majority(features.map(f => f.lyricalStyle));
    const grandStyle    = majority(features.map(f => f.lyricalGrand));

    const grandAvg = Math.round(
      features.map(f => f.lyricalGrandPres ?? 0).reduce((a,b)=>a+b,0) / Math.max(1, features.length)
    );

    const langCounts = countMap(features.map(f => (f.lyricalLang ?? "xx").toLowerCase()));
    const totalLang = Object.values(langCounts).reduce((a,b)=>a+b,0) || 1;
    const langPrefs = Object.entries(langCounts)
      .map(([lang,c]) => ({ lang, share: c/totalLang }))
      .sort((a,b)=>b.share-a.share);

    return { topThemes, dominantMood, dominantStyle, grandStyle, grandAvg, langPrefs, sampleSize: features.length };
  };

  let processedGroups = 0;

  // process in groups of 5
  for (let i = 0; i + CHUNK_SIZE <= newSwipes.length; i += CHUNK_SIZE) {
    const group = newSwipes.slice(i, i + CHUNK_SIZE); // always 5
    const trackInputs: TrackInput[] = group.map(s => ({
      trackId: s.trackId,
      title: s.track.title,
      artist: s.track.artist
    }));

    try {
      // ----- OpenAI CALL #1: analyze 5 tracks in one request -----
      const batch = await analyzeTracksLyricallyBatch(trackInputs);

      // prepare in-memory features representing AFTER this group is applied
      const newFeatureObjects = group.map(s => ({
        id: 0, // not used
        userId,
        trackId: s.trackId,
        lyricalThemes: JSON.stringify(batch[s.trackId]?.lyricalThemes ?? []),
        lyricalMood: batch[s.trackId]?.lyricalMood ?? null,
        lyricalStyle: batch[s.trackId]?.lyricalStyle ?? null,
        lyricalGrand: batch[s.trackId]?.lyricalGrand ?? null,
        lyricalGrandPres: batch[s.trackId]?.lyricalGrandPres ?? null,
        lyricalLang: batch[s.trackId]?.lyricalLang ?? null,
        createdAt: new Date()
      }));

      const projectedAll = [
        ...currentFeatures,
        ...newFeatureObjects.map(o => ({
          ...o,
          // shape-align with Prisma type for aggregation helper
          lyricalThemes: o.lyricalThemes,
        }))
      ];

      const agg = aggregate(projectedAll);

      // ----- OpenAI CALL #2: write assessment based on projected aggregate -----
      const username = (await prisma.user.findUnique({ where: { id: userId } }))?.username ?? `user-${userId}`;
      const assessment = await writeUserAssessment({
        username,
        sampleSize: agg.sampleSize,
        topThemes: agg.topThemes,
        dominantMood: agg.dominantMood ?? undefined,
        dominantStyle: agg.dominantStyle ?? undefined,
        grandStyle: agg.grandStyle ?? undefined,
        grandStyleAvg: agg.grandAvg ?? undefined,
        langPrefs: agg.langPrefs
      });

      // If we got here, both calls succeeded → commit DB changes atomically
      const newestIdInGroup = group[group.length - 1]!.id;

      await prisma.$transaction([
        // upsert 5 features
        ...group.map(s => {
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
              lyricalLang: f?.lyricalLang ?? null
            },
            update: {
              lyricalThemes: JSON.stringify(f?.lyricalThemes ?? []),
              lyricalMood: f?.lyricalMood ?? null,
              lyricalStyle: f?.lyricalStyle ?? null,
              lyricalGrand: f?.lyricalGrand ?? null,
              lyricalGrandPres: f?.lyricalGrandPres ?? null,
              lyricalLang: f?.lyricalLang ?? null
            }
          });
        }),

        // snapshot upsert (full aggregate after this group)
        prisma.userLyricalTaste.upsert({
          where: { userId },
          create: {
            userId,
            topThemesJSON: JSON.stringify(agg.topThemes),
            dominantMood: agg.dominantMood ?? null,
            dominantStyle: agg.dominantStyle ?? null,
            grandStyle: agg.grandStyle ?? null,
            grandStyleAvg: agg.grandAvg ?? null,
            langPrefsJSON: JSON.stringify(agg.langPrefs),
            sampleSize: agg.sampleSize,
            assessment
          },
          update: {
            topThemesJSON: JSON.stringify(agg.topThemes),
            dominantMood: agg.dominantMood ?? null,
            dominantStyle: agg.dominantStyle ?? null,
            grandStyle: agg.grandStyle ?? null,
            grandStyleAvg: agg.grandAvg ?? null,
            langPrefsJSON: JSON.stringify(agg.langPrefs),
            sampleSize: agg.sampleSize,
            assessment,
            updatedAt: new Date()
          }
        }),

        // advance the cursor to include this group
        prisma.tasteProgress.update({
          where: { userId },
          data: { lastProcessedSwipeId: newestIdInGroup, lastProcessedAt: new Date() }
        })
      ]);

      // update in-memory currentFeatures now that DB is committed
      currentFeatures = projectedAll;
      processedGroups += 1;

    } catch (e: any) {
      if (e instanceof OpenAIQuotaError) {
        console.error(`[lyricalTaste] quota hit; stopping after ${processedGroups} groups`);
        // IMPORTANT: we did NOT move the cursor for this group; it will retry later
        break;
      }
      console.error("[lyricalTaste] group processing failed; stopping:", e);
      break;
    }
  }

  return { updated: processedGroups > 0, processedGroups, callsMade: processedGroups * 2 };
}
