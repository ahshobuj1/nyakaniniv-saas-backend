import { prisma } from './src/lib/prisma';
import { WalletService } from './src/Modules/Wallet/wallet.service';

async function main() {
  const walletService = new WalletService(prisma);
  console.log("Releasing escrow...");
  const res = await walletService.releaseBookingEscrow('e8e57696-3435-4aaf-b7fc-f88315e9e26e');
  console.log("Result:", res);
}

main().catch(console.error).finally(() => prisma.$disconnect());
