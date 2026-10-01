import { prisma } from './src/lib/prisma';
import { WalletService } from './src/Modules/Wallet/wallet.service';

async function runTest() {
  console.log("=== STARTING FULL PAYMENT FLOW TEST ===");
  const tenantId = "bad70060-ced6-401f-82f5-9f2fcddae319";
  const walletService = new WalletService(prisma);
  
  // 1. Initial State
  let data = await walletService.getWallet(tenantId);
  console.log("1. Initial Available Balance (Dynamic):", data.balancesByCurrency['KES']?.availableBalance);
  console.log("1. Initial Available Balance (Static):", data.wallet.availableBalance);

  // 2. Simulate Booking Escrow Release
  console.log("\\n--- Simulating Escrow Release (KES 1000) ---");
  const mockBookingId = `mock-booking-${Date.now()}`;
  await prisma.$transaction([
    prisma.walletLedger.create({
      data: {
        walletId: data.wallet.id,
        bookingId: null,
        amount: 1000,
        currency: 'KES',
        type: 'ESCROW_RELEASED',
        referenceId: `ESCROW_RELEASE_${mockBookingId}`,
        description: 'Mock Escrow Release',
        previousBalance: data.wallet.availableBalance,
        newBalance: Number(data.wallet.availableBalance) + 1000,
      }
    }),
    prisma.wallet.update({
      where: { id: data.wallet.id },
      data: { availableBalance: { increment: 1000 } }
    })
  ]);

  // Re-fetch Wallet
  data = await walletService.getWallet(tenantId);
  console.log("2. After Escrow Release, Available Balance (Dynamic):", data.balancesByCurrency['KES']?.availableBalance);
  console.log("2. After Escrow Release, Available Balance (Static):", data.wallet.availableBalance);

  // 3. Simulate Withdrawal
  console.log("\\n--- Simulating Withdrawal Request (KES 500) ---");
  try {
    await walletService.requestWithdrawal(tenantId, 500);
  } catch (err: any) {
    console.log("Expected Error from Gateway:", err.message);
  }

  // 4. Final State Check
  console.log("\\n--- Final Wallet State (Should auto-reverse back to previous amount) ---");
  data = await walletService.getWallet(tenantId);
  console.log("3. Final Available Balance (Dynamic):", data.balancesByCurrency['KES']?.availableBalance);
  console.log("3. Final Available Balance (Static):", data.wallet.availableBalance);

  const reqCount = data.ledgers.filter(l => l.type === 'WITHDRAWAL_REQUESTED' && l.amount === 500).length;
  const revCount = data.ledgers.filter(l => l.type === 'WITHDRAWAL_FAILED_REVERSAL' && l.amount === 500).length;
  console.log(`WITHDRAWAL_REQUESTED ledgers created for 500: ${reqCount}`);
  console.log(`WITHDRAWAL_FAILED_REVERSAL ledgers created for 500: ${revCount}`);
  
  if (reqCount > 0 && reqCount === revCount) {
    console.log("✅ TEST PASSED: Automatic reversal worked perfectly! Everything balances out.");
  } else {
    console.log("❌ TEST FAILED: Ledger mismatch.");
  }
}

runTest().catch(console.error).finally(() => prisma.$disconnect());
