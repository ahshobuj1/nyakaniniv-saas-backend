const fs = require('fs');
const path = require('path');
const file = path.join('src', 'Modules', 'Webhook', 'webhook.service.ts');
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('InvoiceServices')) {
  content = content.replace(
    "import { EmailTemplates } from '@/utils/EmailTemplates';",
    "import { EmailTemplates } from '@/utils/EmailTemplates';\nimport { InvoiceServices } from '../Invoice/invoice.service';"
  );
}

content = content.replace(
  /return \{ djEmail, clientEmail, djName, eventType, clientName, eventDate, resolvedBookingId \};/g,
  'return { djEmail, clientEmail, djName, eventType, clientName, eventDate, resolvedBookingId, paymentId: payment?.id };'
);

const stripeBlockRegex = /\/\/ Send Emails outside transaction[\s\S]*?(?=\/\/ 2\. Handle Subscription Payments)/;
const paystackBlockRegex = /\/\/ Send Emails outside transaction[\s\S]*?(?=return \{ received: true \};)/;

const replacementBlockStripe = `// Send Emails outside transaction
        let pdfBuffer: Buffer | undefined;
        if ((txResult.djEmail || txResult.clientEmail) && txResult.paymentId) {
          try {
            const invoiceService = new InvoiceServices(this.prisma, this.emailProvider);
            pdfBuffer = await invoiceService.generateInvoicePdf(txResult.paymentId);
          } catch (error) {
            console.error("Failed to generate PDF receipt", error);
          }
        }

        const attachments = pdfBuffer ? [{
          filename: \`Receipt-\${txResult.paymentId.split('-')[0].toUpperCase()}.pdf\`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }] : undefined;

        if (txResult.djEmail) {
          this.emailProvider.sendEmail(
            txResult.djEmail,
            "Payment Received! 🎉 - UpBeat Africa",
            EmailTemplates.getPaymentReceivedAlertTemplate(txResult.clientName, amountPaid),
            attachments
          );
        }

        if (txResult.clientEmail && txResult.resolvedBookingId) {
          this.emailProvider.sendEmail(
            txResult.clientEmail,
            "Payment Receipt - UpBeat Africa",
            EmailTemplates.getPaymentReceiptTemplate(
              amountPaid, 
              txResult.eventType,
              txResult.djName,
              txResult.eventDate,
              "Stripe / Credit Card",
              txResult.resolvedBookingId
            ),
            attachments
          );
        }
      }

      `;

const replacementBlockPaystack = `// Send Emails outside transaction
        let pdfBuffer: Buffer | undefined;
        if ((txResult.djEmail || txResult.clientEmail) && txResult.paymentId) {
          try {
            const invoiceService = new InvoiceServices(this.prisma, this.emailProvider);
            pdfBuffer = await invoiceService.generateInvoicePdf(txResult.paymentId);
          } catch (error) {
            console.error("Failed to generate PDF receipt", error);
          }
        }

        const attachments = pdfBuffer ? [{
          filename: \`Receipt-\${txResult.paymentId.split('-')[0].toUpperCase()}.pdf\`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }] : undefined;

        if (txResult.djEmail) {
          this.emailProvider.sendEmail(
            txResult.djEmail,
            "Payment Received! 🎉 - UpBeat Africa",
            EmailTemplates.getPaymentReceivedAlertTemplate(txResult.clientName, amountPaid),
            attachments
          );
        }

        if (txResult.clientEmail && txResult.resolvedBookingId) {
          this.emailProvider.sendEmail(
            txResult.clientEmail,
            "Payment Receipt - UpBeat Africa",
            EmailTemplates.getPaymentReceiptTemplate(
              amountPaid, 
              txResult.eventType,
              txResult.djName,
              txResult.eventDate,
              "Paystack",
              txResult.resolvedBookingId
            ),
            attachments
          );
        }
      }
    }

    `;

content = content.replace(stripeBlockRegex, replacementBlockStripe);
content = content.replace(paystackBlockRegex, replacementBlockPaystack);

fs.writeFileSync(file, content);
console.log('done');
