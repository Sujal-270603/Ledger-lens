-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "creditLedgerId" TEXT;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_creditLedgerId_fkey" FOREIGN KEY ("creditLedgerId") REFERENCES "Ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;
