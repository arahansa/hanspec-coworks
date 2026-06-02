-- AlterTable
ALTER TABLE "Node" ADD COLUMN     "endpoint" VARCHAR(255);

-- CreateTable
CREATE TABLE "tag" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "projectId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_tag" (
    "nodeId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,

    CONSTRAINT "node_tag_pkey" PRIMARY KEY ("nodeId","tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "tag_projectId_name_key" ON "tag"("projectId", "name");

-- AddForeignKey
ALTER TABLE "tag" ADD CONSTRAINT "tag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_tag" ADD CONSTRAINT "node_tag_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_tag" ADD CONSTRAINT "node_tag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
