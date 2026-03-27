import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const entries = await prisma.journalEntry.count();
  const ledgers = await prisma.ledger.count();
  const clients = await prisma.client.count();
  console.log({ entries, ledgers, clients });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
