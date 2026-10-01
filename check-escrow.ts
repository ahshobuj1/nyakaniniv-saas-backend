import { prisma } from './src/lib/prisma';
async function main() {
  const tenantId = "bad70060-ced6-401f-82f5-9f2fcddae319";
  const wallet = await prisma.wallet.findUnique({ where: { tenantId } });
  
  const ledgers = await prisma.walletLedger.findMany({
    where: { walletId: wallet?.id, type: 'ESCROW_RELEASED' }
  });
  console.log("ESCROW_RELEASED ledgers:", JSON.stringify(ledgers, null, 2));
}
main().finally(() => prisma.$disconnect());
