-- DropForeignKey
ALTER TABLE "UserCosmetic" DROP CONSTRAINT "UserCosmetic_cosmeticId_fkey";

-- AddForeignKey
ALTER TABLE "UserCosmetic" ADD CONSTRAINT "UserCosmetic_cosmeticId_fkey" FOREIGN KEY ("cosmeticId") REFERENCES "Cosmetic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
