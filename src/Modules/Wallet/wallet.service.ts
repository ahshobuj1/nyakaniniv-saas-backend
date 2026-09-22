import { PrismaClient, PaymentGateway, PayoutRequestStatus, LedgerType, TransactionStatus } from '@/prisma/generated/client';
import { AppLogger } from '@/core/logging/logger';
import { calculateFinancialBreakdown, getCountryFinancialConfig } from '@/core/config/financial-matrix.config';
import { TransferProviderFactory } from '@/providers/TransferProvider/TransferProviderFactory';

export class WalletService {
  private logger = new AppLogger('WalletService');

  constructor(private prisma: PrismaClient) {}

  /**
   * Get or initialize a tenant's Escrow Wallet with full ledger and payout history
   */
  public async getWallet(tenantId: string) {
    let wallet = await this.prisma.wallet.findUnique({
      where: { tenantId },
      include: {
        payoutRequests: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        walletLedgers: {
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
      },
    });

    if (!wallet) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
      });
      if (!tenant) throw new Error('Tenant not found');

      const countryConfig = getCountryFinancialConfig(tenant.country);

      wallet = await this.prisma.wallet.create({
        data: {
          tenantId,
          pendingBalance: 0,
          availableBalance: 0,
          totalEarnings: 0,
          totalWithdrawn: 0,
          currency: countryConfig.currency || 'KES',
        },
        include: {
          payoutRequests: true,
          walletLedgers: true,
        },
      });
    }

    // Also get active payout account details
    const [activePaymentAccount, tenantRecord] = await Promise.all([
      this.prisma.tenantPaymentAccount.findFirst({
        where: { tenantId, isActive: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          country: true,
          paystackSubaccountId: true,
          pesapalAccountId: true,
          flutterwaveSubaccountId: true,
        },
      }),
    ]);

    let connectedAccount: {
      gateway: string;
      accountId: string;
      subaccountId?: string | null;
      bankName: string;
      accountName?: string;
      recipientCode?: string;
      countryCode?: string | null;
      currencyCode?: string | null;
    } | null = null;

    if (activePaymentAccount) {
      connectedAccount = {
        gateway: activePaymentAccount.gateway,
        accountId: activePaymentAccount.accountId || activePaymentAccount.subaccountId || '',
        subaccountId: activePaymentAccount.subaccountId,
        bankName: (activePaymentAccount.metadata as any)?.bankName || (activePaymentAccount.metadata as any)?.network || 'Connected Payout Account',
        accountName: (activePaymentAccount.metadata as any)?.accountName,
        recipientCode: (activePaymentAccount.metadata as any)?.recipientCode,
        countryCode: activePaymentAccount.countryCode,
        currencyCode: activePaymentAccount.currencyCode,
      };
    } else if (tenantRecord?.paystackSubaccountId) {
      connectedAccount = {
        gateway: 'PAYSTACK',
        accountId: tenantRecord.paystackSubaccountId,
        subaccountId: tenantRecord.paystackSubaccountId,
        bankName: 'Paystack Settlement Account',
        accountName: 'Connected Account',
      };
    } else if (tenantRecord?.flutterwaveSubaccountId) {
      connectedAccount = {
        gateway: 'FLUTTERWAVE',
        accountId: tenantRecord.flutterwaveSubaccountId,
        subaccountId: tenantRecord.flutterwaveSubaccountId,
        bankName: 'Flutterwave Settlement Account',
        accountName: 'Connected Account',
      };
    } else if (tenantRecord?.pesapalAccountId) {
      connectedAccount = {
        gateway: 'PESAPAL',
        accountId: tenantRecord.pesapalAccountId,
        subaccountId: tenantRecord.pesapalAccountId,
        bankName: 'Pesapal Mobile Money / Bank',
        accountName: 'Connected Account',
      };
    }

    const balancesByCurrency: Record<string, { pendingBalance: number; availableBalance: number; totalEarnings: number; totalWithdrawn: number }> = {};
    
    wallet.walletLedgers.forEach(l => {
      const cur = l.currency || wallet.currency;
      if (!balancesByCurrency[cur]) {
        balancesByCurrency[cur] = { pendingBalance: 0, availableBalance: 0, totalEarnings: 0, totalWithdrawn: 0 };
      }
      const bal = balancesByCurrency[cur];
      const amt = Number(l.amount);

      switch (l.type) {
        case 'BOOKING_CREDIT_PENDING':
          bal.pendingBalance += amt;
          bal.totalEarnings += amt;
          break;
        case 'ESCROW_RELEASED':
          bal.pendingBalance -= amt;
          bal.availableBalance += amt;
          break;
        case 'WITHDRAWAL_REQUESTED':
          bal.availableBalance -= amt;
          break;
        case 'WITHDRAWAL_COMPLETED':
          bal.totalWithdrawn += amt;
          break;
        case 'WITHDRAWAL_REJECTED':
        case 'WITHDRAWAL_FAILED_REVERSAL':
          bal.availableBalance += amt;
          break;
        case 'REFUND_ADJUSTMENT':
          bal.pendingBalance -= amt;
          bal.totalEarnings -= amt;
          break;
      }
    });

    return {
      wallet: {
        id: wallet.id,
        tenantId: wallet.tenantId,
        pendingBalance: Number(wallet.pendingBalance),
        availableBalance: Number(wallet.availableBalance),
        totalEarnings: Number(wallet.totalEarnings || 0),
        totalWithdrawn: Number(wallet.totalWithdrawn),
        currency: wallet.currency,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      },
      balancesByCurrency,
      payoutRequests: wallet.payoutRequests.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        fee: Number(p.fee || 0),
        currency: p.currency,
        gateway: p.gateway,
        status: p.status,
        transferReference: p.transferReference,
        recipientCode: p.recipientCode,
        accountDetails: p.accountDetails,
        adminNote: p.adminNote,
        failureReason: p.failureReason,
        processedAt: p.processedAt,
        createdAt: p.createdAt,
      })),
      ledgers: wallet.walletLedgers.map((l) => ({
        id: l.id,
        bookingId: l.bookingId,
        paymentId: l.paymentId,
        transferId: l.transferId,
        referenceId: l.referenceId,
        amount: Number(l.amount),
        currency: l.currency,
        type: l.type,
        previousBalance: Number(l.previousBalance || 0),
        newBalance: Number(l.newBalance || 0),
        status: l.status,
        description: l.description,
        createdAt: l.createdAt,
      })),
      connectedAccount,
    };
  }

  /**
   * Automatically credit DJ net earnings into Pending Escrow Wallet
   * Formula: DJ Net Earning = Gross Booking - Platform Fee (2%) - Gateway Processing Fee
   */
  public async creditBookingEscrow(
    tenantId: string,
    bookingId: string,
    totalGrossAmount: number,
    currency: string = 'KES',
    actualGatewayFee?: number | null,
    paymentId?: string
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, country: true },
    });
    if (!tenant) throw new Error('Tenant not found');

    // 1. Calculate dynamic financial split (Spec #2)
    const breakdown = calculateFinancialBreakdown(
      totalGrossAmount,
      currency,
      actualGatewayFee,
      tenant.country
    );

    // 2. Ensure wallet exists
    const { wallet } = await this.getWallet(tenantId);

    // 3. Prevent duplicate credit for the same booking
    const existingLedger = await this.prisma.walletLedger.findFirst({
      where: {
        walletId: wallet.id,
        bookingId,
        type: LedgerType.BOOKING_CREDIT_PENDING,
      },
    });

    if (existingLedger) {
      this.logger.info(`Booking #${bookingId} already credited to wallet escrow. Skipping duplicate.`);
      return { success: true, message: 'Already credited', breakdown };
    }

    const previousPendingBalance = wallet.pendingBalance;
    const newPendingBalance = Math.round((previousPendingBalance + breakdown.djNetEarning) * 100) / 100;
    const referenceId = `ESCROW_CREDIT_${bookingId.substring(0, 8)}_${Date.now()}`;

    // 4. Atomic database update & permanent audit ledger record
    await this.prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          pendingBalance: newPendingBalance,
          currency,
        },
      });

      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          bookingId,
          paymentId,
          referenceId,
          amount: breakdown.djNetEarning,
          currency,
          type: LedgerType.BOOKING_CREDIT_PENDING,
          previousBalance: previousPendingBalance,
          newBalance: newPendingBalance,
          status: 'CONFIRMED',
          description: `Escrow credit for booking #${bookingId.substring(0, 8)} (Gross: ${currency} ${breakdown.grossAmount}, Platform 2%: ${breakdown.platformFee}, Gateway Fee: ${breakdown.gatewayFee})`,
        },
      });

      // Update Transaction table with financial breakdown if paymentId exists
      if (paymentId) {
        try {
          await tx.transaction.update({
            where: { id: paymentId },
            data: {
              grossAmount: breakdown.grossAmount,
              platformFee: breakdown.platformFee,
              gatewayFee: breakdown.gatewayFee,
              djNetEarning: breakdown.djNetEarning,
              remainingAmount: breakdown.grossAmount,
            },
          });
        } catch (txErr) {
          // Non-blocking if transaction table record is keyed differently
          this.logger.warn(`Could not update transaction ${paymentId} with breakdown:`, txErr);
        }
      }
    });

    this.logger.info(
      `Credited ${currency} ${breakdown.djNetEarning} (Gross: ${breakdown.grossAmount}, Fee: ${breakdown.gatewayFee}) into Escrow for DJ ${tenantId} (Booking #${bookingId})`
    );

    return {
      success: true,
      breakdown,
    };
  }

  /**
   * Release Escrow funds from Pending -> Available when an event completes
   * Formula: Pending -= NetEarning, Available += NetEarning, TotalEarnings += NetEarning
   */
  public async releaseBookingEscrow(bookingId: string) {
    const pendingLedger = await this.prisma.walletLedger.findFirst({
      where: {
        bookingId,
        type: LedgerType.BOOKING_CREDIT_PENDING,
      },
    });

    if (!pendingLedger) {
      this.logger.warn(`No pending escrow found for booking #${bookingId}.`);
      return { success: false, message: 'No pending escrow found' };
    }

    const alreadyReleased = await this.prisma.walletLedger.findFirst({
      where: {
        bookingId,
        type: LedgerType.ESCROW_RELEASED,
      },
    });

    if (alreadyReleased) {
      this.logger.info(`Escrow for booking #${bookingId} already released.`);
      return { success: true, message: 'Already released' };
    }

    const amountToRelease = Number(pendingLedger.amount);
    const referenceId = `ESCROW_RELEASE_${bookingId.substring(0, 8)}_${Date.now()}`;

    await this.prisma.$transaction(async (tx) => {
      const currentWallet = await tx.wallet.findUnique({
        where: { id: pendingLedger.walletId },
      });
      if (!currentWallet) throw new Error('Wallet not found');

      const prevAvailable = Number(currentWallet.availableBalance);
      const newAvailable = Math.round((prevAvailable + amountToRelease) * 100) / 100;
      const newPending = Math.max(0, Math.round((Number(currentWallet.pendingBalance) - amountToRelease) * 100) / 100);
      const newTotalEarnings = Math.round((Number(currentWallet.totalEarnings || 0) + amountToRelease) * 100) / 100;

      await tx.wallet.update({
        where: { id: currentWallet.id },
        data: {
          pendingBalance: newPending,
          availableBalance: newAvailable,
          totalEarnings: newTotalEarnings,
        },
      });

      await tx.walletLedger.create({
        data: {
          walletId: currentWallet.id,
          bookingId,
          referenceId,
          amount: amountToRelease,
          currency: pendingLedger.currency,
          type: LedgerType.ESCROW_RELEASED,
          previousBalance: prevAvailable,
          newBalance: newAvailable,
          status: 'CONFIRMED',
          description: `Escrow released to Available Balance for completed booking #${bookingId.substring(0, 8)}`,
        },
      });
    });

    this.logger.info(`Released ${pendingLedger.currency} ${amountToRelease} from Escrow into Available Balance (Booking #${bookingId})`);
    return { success: true, releasedAmount: amountToRelease };
  }

  /**
   * DJ requests a withdrawal from their available balance
   * Initiates payout via Transfer Provider
   */
  public async requestWithdrawal(tenantId: string, amount: number) {
    if (!amount || amount <= 0) {
      throw new Error('Withdrawal amount must be greater than 0');
    }

    const { wallet, connectedAccount } = await this.getWallet(tenantId);

    if (wallet.availableBalance < amount) {
      throw new Error(`Insufficient balance. Your available balance is ${wallet.currency} ${wallet.availableBalance.toFixed(2)}`);
    }

    if (!connectedAccount) {
      throw new Error('No payout account connected. Please connect a bank or mobile money account first.');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { country: true, stageName: true },
    });

    const countryConfig = getCountryFinancialConfig(tenant?.country);
    const transferFee = countryConfig.transferFee || 50;
    const transferReference = `UPBEAT_TRF_${tenantId.substring(0, 6)}_${Date.now()}`;

    // 1. Deduct available balance and record request
    const prevAvailable = wallet.availableBalance;
    const newAvailable = Math.round((prevAvailable - amount) * 100) / 100;

    const payoutRequest = await this.prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: newAvailable,
        },
      });

      const pRequest = await tx.payoutRequest.create({
        data: {
          walletId: wallet.id,
          tenantId,
          amount,
          fee: transferFee,
          currency: wallet.currency,
          gateway: (connectedAccount.gateway as PaymentGateway) || PaymentGateway.PAYSTACK,
          status: PayoutRequestStatus.PROCESSING,
          transferReference,
          recipientCode: connectedAccount.recipientCode || connectedAccount.accountId,
          accountDetails: connectedAccount as any,
        },
      });

      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          transferId: pRequest.id,
          referenceId: transferReference,
          amount,
          currency: wallet.currency,
          type: LedgerType.WITHDRAWAL_REQUESTED,
          previousBalance: prevAvailable,
          newBalance: newAvailable,
          status: 'PROCESSING',
          description: `Withdrawal request #${pRequest.id.substring(0, 8)} of ${wallet.currency} ${amount} submitted`,
        },
      });

      return pRequest;
    });

    // 2. Dispatch to Payout Provider API via PaymentProviderResolver
    try {
      const { PaymentProviderResolver } = await import('@/Modules/PaymentProvider/PaymentProviderResolver');
      const payoutProvider = PaymentProviderResolver.resolve({
        country: tenant?.country,
        operation: 'PAYOUT',
        requestedGateway: connectedAccount.gateway,
      });

      const transferResult = await payoutProvider.initiatePayout({
        amount,
        currency: wallet.currency,
        recipientCode: connectedAccount.recipientCode || connectedAccount.accountId,
        transferReference,
        reason: `DJ Withdrawal - ${tenant?.stageName || 'UpBeat DJ'}`,
        metadata: {
          tenantId,
          bankName: connectedAccount.bankName,
          accountName: connectedAccount.accountName,
        },
      });

      if (transferResult.status === 'FAILED') {
        await this.handleTransferFailure(payoutRequest.id, 'Transfer provider rejected request');
        throw new Error('Failed to dispatch payout transfer');
      }

      if (transferResult.status === 'COMPLETED') {
        await this.handleTransferSuccess(payoutRequest.id);
      }

      return {
        ...payoutRequest,
        status: transferResult.status,
      };
    } catch (err: any) {
      this.logger.error(`Transfer dispatch error for request ${payoutRequest.id}:`, err.message);
      await this.handleTransferFailure(payoutRequest.id, err.message);
      throw err;
    }
  }

  /**
   * Payout transfer succeeded (via webhook or synchronous completion)
   */
  public async handleTransferSuccess(payoutRequestId: string) {
    const payout = await this.prisma.payoutRequest.findUnique({
      where: { id: payoutRequestId },
    });
    if (!payout || payout.status === PayoutRequestStatus.COMPLETED) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payoutRequest.update({
        where: { id: payoutRequestId },
        data: {
          status: PayoutRequestStatus.COMPLETED,
          processedAt: new Date(),
        },
      });

      await tx.wallet.update({
        where: { id: payout.walletId },
        data: {
          totalWithdrawn: {
            increment: payout.amount,
          },
        },
      });

      const currentWallet = await tx.wallet.findUnique({ where: { id: payout.walletId } });
      const currentBalance = Number(currentWallet?.availableBalance || 0);

      await tx.walletLedger.create({
        data: {
          walletId: payout.walletId,
          transferId: payout.id,
          referenceId: `SUCCESS_${payout.transferReference || payout.id}_${Date.now()}`,
          amount: payout.amount,
          currency: payout.currency,
          type: LedgerType.WITHDRAWAL_COMPLETED,
          previousBalance: currentBalance,
          newBalance: currentBalance,
          status: 'COMPLETED',
          description: `Withdrawal transfer completed successfully to ${payout.currency} destination`,
        },
      });
    });

    this.logger.info(`Payout #${payoutRequestId} marked as COMPLETED`);
  }

  /**
   * Payout transfer failed: automatically reverses funds back into DJ's Available Balance (Spec #7)
   */
  public async handleTransferFailure(payoutRequestId: string, failureReason?: string) {
    const payout = await this.prisma.payoutRequest.findUnique({
      where: { id: payoutRequestId },
    });
    if (!payout || payout.status === PayoutRequestStatus.FAILED || payout.status === PayoutRequestStatus.REJECTED) {
      return;
    }

    const refundAmount = Number(payout.amount);

    await this.prisma.$transaction(async (tx) => {
      const currentWallet = await tx.wallet.findUnique({ where: { id: payout.walletId } });
      if (!currentWallet) throw new Error('Wallet not found');

      const prevAvailable = Number(currentWallet.availableBalance);
      const restoredAvailable = Math.round((prevAvailable + refundAmount) * 100) / 100;

      await tx.payoutRequest.update({
        where: { id: payoutRequestId },
        data: {
          status: PayoutRequestStatus.FAILED,
          failureReason: failureReason || 'Transfer provider payout failed',
          processedAt: new Date(),
        },
      });

      await tx.wallet.update({
        where: { id: currentWallet.id },
        data: {
          availableBalance: restoredAvailable,
        },
      });

      await tx.walletLedger.create({
        data: {
          walletId: currentWallet.id,
          transferId: payout.id,
          referenceId: `REVERSAL_${payout.transferReference || payout.id}_${Date.now()}`,
          amount: refundAmount,
          currency: payout.currency,
          type: LedgerType.WITHDRAWAL_FAILED_REVERSAL,
          previousBalance: prevAvailable,
          newBalance: restoredAvailable,
          status: 'RESTORED',
          description: `Transfer failed: ${refundAmount} ${payout.currency} safely restored to Available Balance (${failureReason || 'Provider rejected'})`,
        },
      });
    });

    this.logger.info(`Payout #${payoutRequestId} failed. Successfully restored ${refundAmount} to DJ wallet`);
  }

  /**
   * Handle Customer Refund / Partial Refund with wallet ledger adjustment (Spec #10)
   */
  public async handleRefund(
    paymentReference: string,
    refundAmount: number,
    reason: string = 'Customer booking refund'
  ) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { gatewayReference: paymentReference },
      include: { invoice: true },
    });

    if (!transaction || !transaction.tenantId) {
      throw new Error('Transaction or tenant not found for refund');
    }

    const { wallet } = await this.getWallet(transaction.tenantId);
    const originalGross = Number(transaction.grossAmount || transaction.amount);
    const currentRefunded = Number(transaction.refundedAmount || 0);
    const newRefunded = Math.round((currentRefunded + refundAmount) * 100) / 100;
    const remainingAmount = Math.max(0, originalGross - newRefunded);

    const isFullRefund = remainingAmount === 0;
    const newStatus = isFullRefund ? TransactionStatus.REFUNDED : TransactionStatus.PARTIALLY_REFUNDED;

    // Deduct proportionate DJ net earnings
    const prevAvailable = wallet.availableBalance;
    const newAvailable = Math.max(0, Math.round((prevAvailable - refundAmount) * 100) / 100);

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: newStatus,
          refundedAmount: newRefunded,
          remainingAmount,
        },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: newAvailable,
        },
      });

      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          paymentId: transaction.id,
          referenceId: `REFUND_${transaction.id.substring(0, 8)}_${Date.now()}`,
          amount: refundAmount,
          currency: transaction.currency,
          type: LedgerType.REFUND_ADJUSTMENT,
          previousBalance: prevAvailable,
          newBalance: newAvailable,
          status: 'REFUNDED',
          description: `Refund adjustment: -${transaction.currency} ${refundAmount} (${reason})`,
        },
      });
    });

    return {
      success: true,
      refundedAmount: newRefunded,
      remainingAmount,
      status: newStatus,
    };
  }
}
