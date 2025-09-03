-- CreateTable
CREATE TABLE "LyricalFeature" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "trackId" TEXT NOT NULL,
    "lyricalThemes" TEXT,
    "lyricalMood" TEXT,
    "lyricalStyle" TEXT,
    "lyricalGrand" TEXT,
    "lyricalGrandPres" INTEGER,
    "lyricalLang" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LyricalFeature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LyricalFeature_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TasteProgress" (
    "userId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lastProcessedSwipeId" INTEGER,
    "lastProcessedAt" DATETIME,
    CONSTRAINT "TasteProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserLyricalTaste" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "topThemesJSON" TEXT,
    "dominantMood" TEXT,
    "dominantStyle" TEXT,
    "grandStyle" TEXT,
    "grandStyleAvg" INTEGER,
    "langPrefsJSON" TEXT,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessment" TEXT,
    CONSTRAINT "UserLyricalTaste_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LyricalFeature_userId_createdAt_idx" ON "LyricalFeature"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LyricalFeature_trackId_idx" ON "LyricalFeature"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "LyricalFeature_userId_trackId_key" ON "LyricalFeature"("userId", "trackId");

-- CreateIndex
CREATE UNIQUE INDEX "UserLyricalTaste_userId_key" ON "UserLyricalTaste"("userId");
