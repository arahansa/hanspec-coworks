-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('CLAUDE', 'USER');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('QUESTION', 'ANSWER', 'INSTRUCTION');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'ANSWERED', 'ACKNOWLEDGED');

-- CreateTable
CREATE TABLE "node_message" (
    "id" SERIAL NOT NULL,
    "nodeId" INTEGER NOT NULL,
    "role" "MessageRole" NOT NULL,
    "kind" "MessageKind" NOT NULL,
    "status" "MessageStatus",
    "body" TEXT NOT NULL,
    "options" JSONB,
    "selectedOption" INTEGER,
    "consumedAt" TIMESTAMP(3),
    "parentId" INTEGER,
    "authorMemberId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "node_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "node_message_nodeId_createdAt_idx" ON "node_message"("nodeId", "createdAt");

-- CreateIndex
CREATE INDEX "node_message_status_idx" ON "node_message"("status");

-- AddForeignKey
ALTER TABLE "node_message" ADD CONSTRAINT "node_message_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_message" ADD CONSTRAINT "node_message_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "node_message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_message" ADD CONSTRAINT "node_message_authorMemberId_fkey" FOREIGN KEY ("authorMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
