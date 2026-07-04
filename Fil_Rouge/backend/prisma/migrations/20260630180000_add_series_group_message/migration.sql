CREATE TABLE "SeriesGroupMessage" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeriesGroupMessage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SeriesGroupMessage" ADD CONSTRAINT "SeriesGroupMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SeriesGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeriesGroupMessage" ADD CONSTRAINT "SeriesGroupMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
