import { PrismaClient } from './src/prisma/generated/client.ts';
const prisma = new PrismaClient();

async function main() {
  const txs = await prisma.transaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { invoice: true }
  });
  console.log(JSON.stringify(txs, null, 2));
  
  const ledgers = await prisma.walletLedger.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('--- LEDGERS ---');
  console.log(JSON.stringify(ledgers, null, 2));

  const wallets = await prisma.wallet.findMany({
    take: 2
  });
  console.log('--- WALLETS ---');
  console.log(JSON.stringify(wallets, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
