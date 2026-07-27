-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN "originalLang" TEXT NOT NULL DEFAULT 'fr';
ALTER TABLE "Challenge" ADD COLUMN "titleFr" TEXT;
ALTER TABLE "Challenge" ADD COLUMN "descriptionFr" TEXT;
ALTER TABLE "Challenge" ADD COLUMN "seriesNameFr" TEXT;
