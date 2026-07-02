-- AlterTable
ALTER TABLE "slide" ADD COLUMN     "document" JSONB,
ALTER COLUMN "content" DROP NOT NULL;
