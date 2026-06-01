-- CreateEnum
CREATE TYPE "NodeStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'DONE');

-- AlterTable
ALTER TABLE "Node" ADD COLUMN     "status" "NodeStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "node_assignee" (
    "nodeId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "node_assignee_pkey" PRIMARY KEY ("nodeId","memberId")
);

-- AddForeignKey
ALTER TABLE "node_assignee" ADD CONSTRAINT "node_assignee_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_assignee" ADD CONSTRAINT "node_assignee_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
