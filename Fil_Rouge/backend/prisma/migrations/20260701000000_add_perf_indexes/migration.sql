-- Performance indexes for hot query paths
CREATE INDEX IF NOT EXISTS "Challenge_seriesName_idx" ON "Challenge"("seriesName");
CREATE INDEX IF NOT EXISTS "UserChallenge_userId_status_idx" ON "UserChallenge"("userId", "status");
CREATE INDEX IF NOT EXISTS "SeriesGroupMember_userId_idx" ON "SeriesGroupMember"("userId");
CREATE INDEX IF NOT EXISTS "SeriesGroupMember_groupId_idx" ON "SeriesGroupMember"("groupId");
CREATE INDEX IF NOT EXISTS "SeriesGroupMessage_groupId_createdAt_idx" ON "SeriesGroupMessage"("groupId", "createdAt");
