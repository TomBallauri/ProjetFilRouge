-- CreateTable
CREATE TABLE "SeriesGroup" (
    "id" SERIAL NOT NULL,
    "seriesName" TEXT NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeriesGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeriesGroupMember" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),
    CONSTRAINT "SeriesGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeriesGroupMember_groupId_userId_key" ON "SeriesGroupMember"("groupId", "userId");

-- AddForeignKey
ALTER TABLE "SeriesGroup" ADD CONSTRAINT "SeriesGroup_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeriesGroupMember" ADD CONSTRAINT "SeriesGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SeriesGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeriesGroupMember" ADD CONSTRAINT "SeriesGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
