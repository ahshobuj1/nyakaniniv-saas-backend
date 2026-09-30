import { prisma } from './src/lib/prisma';
async function main() {
  const t = await prisma.tenant.findUnique({where:{id:'bad70060-ced6-401f-82f5-9f2fcddae319'}});
  console.log("Country is:", t?.country);
}
main().catch(console.error).finally(()=>prisma.$disconnect());
