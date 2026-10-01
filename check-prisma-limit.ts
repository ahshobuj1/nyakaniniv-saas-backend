import { prisma } from './src/lib/prisma';
async function main() {
  const tenantId = "bad70060-ced6-401f-82f5-9f2fcddae319";
  const wallet = await prisma.wallet.findUnique({
    where: { tenantId },
    include: {
      walletLedgers: {
        orderBy: { createdAt: 'desc' },
      }
    }
  });
  console.log(`Prisma returned ${wallet?.walletLedgers.length} ledgers`);
  const hasEscrow = wallet?.walletLedgers.some(l => l.type === 'ESCROW_RELEASED');
  console.log(`Has ESCROW_RELEASED: ${hasEscrow}`);
}
main().finally(() => prisma.$disconnect());
