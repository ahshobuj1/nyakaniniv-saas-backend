import crypto from 'crypto';
import { PrismaClient } from './src/prisma/generated/client';

async function testWebhook() {
  const prisma = new PrismaClient();
  const payment = await prisma.bookingPayment.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  
  if (!payment) {
    console.log('No payment found to test');
    process.exit(0);
  }
  
  console.log('Testing with payment:', payment.id, 'and bookingId:', payment.bookingId);
  
  const payload = {
    event: 'charge.success',
    data: {
      id: 123456,
      amount: 500000,
      metadata: {
        invoiceId: payment.id,
        bookingId: payment.bookingId
      },
      reference: 'test_ref_123',
      authorization: {
        authorization_code: 'AUTH_123',
        card_type: 'visa',
        last4: '1234',
        brand: 'visa'
      }
    }
  };
  
  const payloadStr = JSON.stringify(payload);
  const secret = process.env.PAYSTACK_SECRET_KEY || 'sk_test_mock';
  const hash = crypto.createHmac('sha512', secret).update(payloadStr).digest('hex');
  
  try {
    const res = await fetch('http://localhost:3030/api/v1/webhooks/paystack', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-paystack-signature': hash
      },
      body: payloadStr
    });
    
    console.log('Response status:', res.status);
    console.log('Response body:', await res.text());
    
    const updatedPayment = await prisma.bookingPayment.findUnique({ where: { id: payment.id } });
    console.log('Updated Payment Status:', updatedPayment?.status);
  } catch (error) {
    console.error('Fetch error:', error);
  }
  
  await prisma.$disconnect();
}

testWebhook().catch(console.error);
