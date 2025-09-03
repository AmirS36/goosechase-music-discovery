-- CreateTable
CREATE TABLE "LyricAnalysisCache" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "trackId" INTEGER,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "snippet" TEXT,
    "result" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "LyricAnalysisCache_trackId_key" ON "LyricAnalysisCache"("trackId");

-- CreateIndex
CREATE INDEX "LyricAnalysisCache_title_artist_idx" ON "LyricAnalysisCache"("title", "artist");
