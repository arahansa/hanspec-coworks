-- CreateTable
CREATE TABLE "slide_page" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slide_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slide" (
    "id" SERIAL NOT NULL,
    "pageId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slide_section" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slide_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slide_section_page" (
    "id" SERIAL NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "pageId" INTEGER NOT NULL,

    CONSTRAINT "slide_section_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slide_comment" (
    "id" SERIAL NOT NULL,
    "slideId" INTEGER NOT NULL,
    "commentNum" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slide_comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "slide_page_projectId_idx" ON "slide_page"("projectId");

-- CreateIndex
CREATE INDEX "slide_pageId_idx" ON "slide"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "slide_pageId_version_key" ON "slide"("pageId", "version");

-- CreateIndex
CREATE INDEX "slide_section_projectId_idx" ON "slide_section"("projectId");

-- CreateIndex
CREATE INDEX "slide_section_page_pageId_idx" ON "slide_section_page"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "slide_section_page_sectionId_pageId_key" ON "slide_section_page"("sectionId", "pageId");

-- CreateIndex
CREATE INDEX "slide_comment_slideId_idx" ON "slide_comment"("slideId");

-- CreateIndex
CREATE UNIQUE INDEX "slide_comment_slideId_commentNum_key" ON "slide_comment"("slideId", "commentNum");

-- AddForeignKey
ALTER TABLE "slide_page" ADD CONSTRAINT "slide_page_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slide" ADD CONSTRAINT "slide_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "slide_page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slide_section" ADD CONSTRAINT "slide_section_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slide_section_page" ADD CONSTRAINT "slide_section_page_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "slide_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slide_section_page" ADD CONSTRAINT "slide_section_page_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "slide_page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slide_comment" ADD CONSTRAINT "slide_comment_slideId_fkey" FOREIGN KEY ("slideId") REFERENCES "slide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
