-- CreateTable
CREATE TABLE "complete_notification" (
    "id" SERIAL NOT NULL,
    "triggerNodeId" INTEGER NOT NULL,
    "targetNodeId" INTEGER NOT NULL,
    "receiverId" INTEGER,
    "groupId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complete_notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "complete_notification_triggerNodeId_idx" ON "complete_notification"("triggerNodeId");

-- AddForeignKey
ALTER TABLE "complete_notification" ADD CONSTRAINT "complete_notification_triggerNodeId_fkey" FOREIGN KEY ("triggerNodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complete_notification" ADD CONSTRAINT "complete_notification_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complete_notification" ADD CONSTRAINT "complete_notification_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complete_notification" ADD CONSTRAINT "complete_notification_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "member_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
