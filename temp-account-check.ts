import { prisma } from './src/lib/prisma';

async function main() {
  const account = await prisma.tenantPaymentAccount.findFirst({
    where: { tenantId: 'bad70060-ced6-401f-82f5-9f2fcddae319' }
  });
  console.log("Account for tenant bad70060-ced6-401f-82f5-9f2fcddae319:");
  console.log(JSON.stringify(account, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
