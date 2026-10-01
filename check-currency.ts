import { prisma } from './src/lib/prisma';
async function main() {
  const tenantId = "bad70060-ced6-401f-82f5-9f2fcddae319";
  const wallet = await prisma.wallet.findUnique({ where: { tenantId } });
  console.log(`Wallet currency: "${wallet?.currency}"`);
}
main();
