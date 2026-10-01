import { prisma } from './src/lib/prisma';
async function main() {
  const mockLedgers = await prisma.walletLedger.findMany({
    where: { description: 'Mock Escrow Release' }
  });
  console.log(`Found ${mockLedgers.length} mock ledgers`);
  for (const l of mockLedgers) {
    await prisma.walletLedger.delete({ where: { id: l.id } });
  }
  
  // also delete mock withdrawal requests/reversals associated with this run
  // wait, the amount was 500
  const mockWithdrawals = await prisma.walletLedger.findMany({
    where: { amount: 500 }
  });
  for (const l of mockWithdrawals) {
    await prisma.walletLedger.delete({ where: { id: l.id } });
  }
  
  console.log("Cleanup complete!");
}
main().finally(() => prisma.$disconnect());
