/*
  Warnings:

  - You are about to alter the column `spotifyTokenExpiresAt` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Int` to `DateTime`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "preferenceId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "spotifyId" TEXT,
    "spotifyDisplayName" TEXT,
    "spotifyImageUrl" TEXT,
    "spotifyAccessToken" TEXT,
    "spotifyRefreshToken" TEXT,
    "spotifyTokenExpiresAt" DATETIME,
    "spotifyTokenType" TEXT,
    "spotifyScope" TEXT,
    "spotifyLinkedAt" DATETIME,
    CONSTRAINT "User_preferenceId_fkey" FOREIGN KEY ("preferenceId") REFERENCES "Preference" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "id", "password", "preferenceId", "spotifyAccessToken", "spotifyDisplayName", "spotifyId", "spotifyImageUrl", "spotifyRefreshToken", "spotifyTokenExpiresAt", "updatedAt", "username") SELECT "createdAt", "id", "password", "preferenceId", "spotifyAccessToken", "spotifyDisplayName", "spotifyId", "spotifyImageUrl", "spotifyRefreshToken", "spotifyTokenExpiresAt", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_preferenceId_key" ON "User"("preferenceId");
CREATE UNIQUE INDEX "User_spotifyId_key" ON "User"("spotifyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
