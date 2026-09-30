import { prisma } from './src/lib/prisma';

async function main() {
  const account = await prisma.tenantPaymentAccount.findFirst({
    where: { tenantId: 'bad70060-ced6-401f-82f5-9f2fcddae319' }
  });
  
  if (account) {
    const meta = account.metadata as any || {};
    meta.bankCode = '05'; // Bank of India
    await prisma.tenantPaymentAccount.update({
      where: { id: account.id },
      data: { metadata: meta }
    });
    console.log("Updated metadata with bankCode: 05");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
