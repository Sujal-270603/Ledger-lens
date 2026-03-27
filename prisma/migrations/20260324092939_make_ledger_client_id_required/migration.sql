/*
  Warnings:

  - Made the column `clientId` on table `Ledger` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Ledger" DROP CONSTRAINT "Ledger_clientId_fkey";

-- AlterTable
ALTER TABLE "Ledger" ALTER COLUMN "clientId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
