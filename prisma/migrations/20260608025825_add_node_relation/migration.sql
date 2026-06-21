-- CreateTable
CREATE TABLE "node_relation" (
    "nodeAId" INTEGER NOT NULL,
    "nodeBId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "node_relation_pkey" PRIMARY KEY ("nodeAId","nodeBId")
);

-- CreateIndex
CREATE INDEX "node_relation_nodeBId_idx" ON "node_relation"("nodeBId");

-- AddForeignKey
ALTER TABLE "node_relation" ADD CONSTRAINT "node_relation_nodeAId_fkey" FOREIGN KEY ("nodeAId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_relation" ADD CONSTRAINT "node_relation_nodeBId_fkey" FOREIGN KEY ("nodeBId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;
