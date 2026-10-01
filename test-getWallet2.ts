import { prisma } from './src/lib/prisma';
import { WalletService } from './src/Modules/Wallet/wallet.service';

async function main() {
  const service = new WalletService(prisma);
  const data = await service.getWallet("bad70060-ced6-401f-82f5-9f2fcddae319");
  
  const escrowLedgers = data.ledgers.filter(l => l.type === 'ESCROW_RELEASED');
  console.log("ESCROW_RELEASED ledgers in getWallet:", JSON.stringify(escrowLedgers, null, 2));
  console.log("balancesByCurrency:", JSON.stringify(data.balancesByCurrency, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
