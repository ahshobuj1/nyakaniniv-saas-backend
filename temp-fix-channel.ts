import { prisma } from './src/lib/prisma';
async function main() {
  const invoice = await prisma.invoice.findFirst({
    where: { bookingId: 'b58ea8bb-afb6-4dc4-af23-894163d2c1f0' }
  });
  if (invoice) {
    await prisma.transaction.updateMany({
      where: { invoiceId: invoice.id },
      data: {
        channel: 'CARD',
        gateway: 'FLUTTERWAVE'
      }
    });
    console.log("Updated channel in DB");
  }
}
main().finally(()=>prisma.$disconnect());
