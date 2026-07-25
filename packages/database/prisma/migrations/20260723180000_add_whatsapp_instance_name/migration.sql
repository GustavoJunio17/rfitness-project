-- AlterTable
ALTER TABLE "gyms" ADD COLUMN     "whatsappInstanceName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "gyms_whatsappInstanceName_key" ON "gyms"("whatsappInstanceName");

