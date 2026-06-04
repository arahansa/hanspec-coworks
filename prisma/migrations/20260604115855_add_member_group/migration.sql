-- CreateTable
CREATE TABLE "member_group" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "projectId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_group_participant" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,

    CONSTRAINT "member_group_participant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "member_group_participant_groupId_memberId_key" ON "member_group_participant"("groupId", "memberId");

-- AddForeignKey
ALTER TABLE "member_group" ADD CONSTRAINT "member_group_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_group_participant" ADD CONSTRAINT "member_group_participant_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "member_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_group_participant" ADD CONSTRAINT "member_group_participant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
