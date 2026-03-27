/*
  Warnings:

  - A unique constraint covering the columns `[clientId,name]` on the table `Ledger` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Ledger_organizationId_name_key";

-- AlterTable
ALTER TABLE "Ledger" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Ledger_clientId_name_key" ON "Ledger"("clientId", "name");

-- AddForeignKey
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
