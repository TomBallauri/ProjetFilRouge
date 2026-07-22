-- ChallengeGroupMember and GroupMessage were missing the indexes their SeriesGroup*
-- equivalents already have (see 20260701000000_add_perf_indexes) — every group/message
-- lookup by userId or groupId was doing a full table scan.
CREATE INDEX IF NOT EXISTS "ChallengeGroupMember_userId_idx" ON "ChallengeGroupMember"("userId");
CREATE INDEX IF NOT EXISTS "GroupMessage_groupId_createdAt_idx" ON "GroupMessage"("groupId", "createdAt");
