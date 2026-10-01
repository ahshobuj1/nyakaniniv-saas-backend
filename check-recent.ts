import { prisma } from './src/lib/prisma';

async function main() {
  const tenantId = "bad70060-ced6-401f-82f5-9f2fcddae319";
  
  const wallet = await prisma.wallet.findUnique({
    where: { tenantId },
    include: {
      payoutRequests: { orderBy: { createdAt: 'desc' } }
    }
  });

  if (!wallet) return;

  wallet.payoutRequests.forEach(p => {
    console.log(`[${p.createdAt.toISOString()}] ${p.status} - Amt: ${p.amount} - Currency: ${p.currency} - Gateway: ${p.gateway} - FailureReason: ${p.failureReason || 'None'}`);
  });
}
main().catch(console.error).finally(() => prisma.$disconnect());
