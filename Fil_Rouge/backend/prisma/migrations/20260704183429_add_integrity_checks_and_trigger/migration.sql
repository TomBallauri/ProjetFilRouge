-- Contraintes d'intégrité : la base refuse les états incohérents même si
-- l'application se trompe (bug, appel direct à l'API, requête manuelle).
ALTER TABLE "User"
  ADD CONSTRAINT "User_coins_nonneg"  CHECK ("coins" >= 0),
  ADD CONSTRAINT "User_xp_nonneg"     CHECK ("xp" >= 0),
  ADD CONSTRAINT "User_level_min"     CHECK ("level" >= 1),
  ADD CONSTRAINT "User_streak_nonneg" CHECK ("currentStreak" >= 0 AND "longestStreak" >= 0);

ALTER TABLE "Challenge"
  ADD CONSTRAINT "Challenge_coinReward_nonneg" CHECK ("coinReward" >= 0),
  ADD CONSTRAINT "Challenge_xpReward_nonneg"   CHECK ("xpReward" >= 0);

ALTER TABLE "Cosmetic"
  ADD CONSTRAINT "Cosmetic_price_nonneg" CHECK ("price" >= 0);

-- Déclencheur : quand un défi passe au statut COMPLETED, la date de
-- complétion est posée par la base elle-même si l'application a oublié de
-- la renseigner (ou l'a renseignée à NULL par erreur). Une contrainte seule
-- ne peut pas exprimer "si ce champ change, dérive automatiquement cet
-- autre champ" — c'est exactement le cas d'usage d'un déclencheur.
CREATE OR REPLACE FUNCTION set_user_challenge_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."status" = 'COMPLETED' AND (OLD."status" IS DISTINCT FROM 'COMPLETED') AND NEW."completedAt" IS NULL THEN
    NEW."completedAt" := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_challenge_completed_at ON "UserChallenge";
CREATE TRIGGER trg_user_challenge_completed_at
  BEFORE UPDATE ON "UserChallenge"
  FOR EACH ROW
  EXECUTE FUNCTION set_user_challenge_completed_at();