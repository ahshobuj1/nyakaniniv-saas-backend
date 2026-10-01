import { prisma } from './src/lib/prisma';

async function main() {
  const tenantId = "bad70060-ced6-401f-82f5-9f2fcddae319";
  
  const wallet = await prisma.wallet.findUnique({
    where: { tenantId },
    include: {
      walletLedgers: { orderBy: { createdAt: 'desc' } },
      payoutRequests: { orderBy: { createdAt: 'desc' } }
    }
  });

  if (!wallet) return;

  console.log("Static Available:", wallet.availableBalance);
  
  let escrow = 0;
  let withdraw_req = 0;
  let withdraw_rev = 0;

  wallet.walletLedgers.forEach(l => {
    const amt = Number(l.amount);
    if (l.type === 'ESCROW_RELEASED') { escrow += amt; console.log("ESCROW_RELEASED:", amt); }
    if (l.type === 'WITHDRAWAL_REQUESTED') { withdraw_req += amt; console.log("WITHDRAWAL_REQUESTED:", amt); }
    if (l.type === 'WITHDRAWAL_FAILED_REVERSAL') { withdraw_rev += amt; console.log("WITHDRAWAL_FAILED_REVERSAL:", amt); }
  });

  console.log(`Sum: ESCROW (${escrow}) - REQ (${withdraw_req}) + REV (${withdraw_rev}) = ${escrow - withdraw_req + withdraw_rev}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
