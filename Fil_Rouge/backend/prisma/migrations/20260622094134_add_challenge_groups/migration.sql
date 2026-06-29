-- CreateTable
CREATE TABLE "ChallengeGroup" (
    "id" SERIAL NOT NULL,
    "challengeId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChallengeGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeGroupMember" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "ChallengeGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeGroupMember_groupId_userId_key" ON "ChallengeGroupMember"("groupId", "userId");

-- AddForeignKey
ALTER TABLE "ChallengeGroup" ADD CONSTRAINT "ChallengeGroup_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeGroup" ADD CONSTRAINT "ChallengeGroup_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeGroupMember" ADD CONSTRAINT "ChallengeGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ChallengeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeGroupMember" ADD CONSTRAINT "ChallengeGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
