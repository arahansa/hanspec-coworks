-- CreateTable
CREATE TABLE "request_notification" (
    "id" SERIAL NOT NULL,
    "senderId" INTEGER NOT NULL,
    "receiverId" INTEGER,
    "groupId" INTEGER,
    "nodeId" INTEGER NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_notification_receiverId_idx" ON "request_notification"("receiverId");

-- CreateIndex
CREATE INDEX "request_notification_groupId_idx" ON "request_notification"("groupId");

-- CreateIndex
CREATE INDEX "request_notification_senderId_idx" ON "request_notification"("senderId");

-- AddForeignKey
ALTER TABLE "request_notification" ADD CONSTRAINT "request_notification_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_notification" ADD CONSTRAINT "request_notification_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_notification" ADD CONSTRAINT "request_notification_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "member_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_notification" ADD CONSTRAINT "request_notification_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;
