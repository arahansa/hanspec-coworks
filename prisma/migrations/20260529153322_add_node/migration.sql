-- CreateEnum
CREATE TYPE "NodeLevel" AS ENUM ('MODULE', 'FEATURE', 'REQUIREMENT');

-- CreateTable
CREATE TABLE "Node" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "level" "NodeLevel" NOT NULL,
    "description" TEXT,
    "parentId" INTEGER,
    "projectId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Node_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Node" ADD CONSTRAINT "Node_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Node" ADD CONSTRAINT "Node_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
