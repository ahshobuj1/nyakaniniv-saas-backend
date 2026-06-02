import { prisma } from '@/lib/prisma';

async function main() {
  console.log('Seeding Database...');

  // Subscription Plans
  const plans = [
    {
      id: 1,
      name: 'Starter',
      priceMonthly: 15.00,
      priceAnnually: 150.00, // example 2 months free
      discountPercentage: 16,
      stripeMonthlyPriceId: 'price_starter_monthly_mock',
      stripeAnnualPriceId: 'price_starter_annual_mock',
      features: {
        CUSTOM_SUBDOMAIN: true,
        BASIC_PROFILE: true,
        MANUAL_BOOKINGS: true,
        MAX_EVENTS: 5
      }
    },
    {
      id: 2,
      name: 'Pro',
      priceMonthly: 39.00,
      priceAnnually: 390.00,
      discountPercentage: 16,
      stripeMonthlyPriceId: 'price_pro_monthly_mock',
      stripeAnnualPriceId: 'price_pro_annual_mock',
      features: {
        CUSTOM_SUBDOMAIN: true,
        BASIC_PROFILE: true,
        MANUAL_BOOKINGS: true,
        ONLINE_PAYMENTS: true,
        AUTOMATED_INVOICING: true,
        MULTIPLE_THEMES: true,
        EMAIL_NOTIFICATIONS: true,
        BASIC_ANALYTICS: true,
        MAX_EVENTS: 50
      }
    },
    {
      id: 3,
      name: 'Elite',
      priceMonthly: 79.00,
      priceAnnually: 790.00,
      discountPercentage: 16,
      stripeMonthlyPriceId: 'price_elite_monthly_mock',
      stripeAnnualPriceId: 'price_elite_annual_mock',
      features: {
        CUSTOM_SUBDOMAIN: true,
        BASIC_PROFILE: true,
        MANUAL_BOOKINGS: true,
        ONLINE_PAYMENTS: true,
        AUTOMATED_INVOICING: true,
        MULTIPLE_THEMES: true,
        EMAIL_NOTIFICATIONS: true,
        BASIC_ANALYTICS: true,
        CUSTOM_DOMAIN: true,
        ADVANCED_ANALYTICS: true,
        REMOVE_BRANDING: true,
        PRIORITY_SUPPORT: true,
        MAX_EVENTS: -1 // -1 means unlimited
      }
    }
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { id: plan.id },
      update: {
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        priceAnnually: plan.priceAnnually,
        discountPercentage: plan.discountPercentage,
        stripeMonthlyPriceId: plan.stripeMonthlyPriceId,
        stripeAnnualPriceId: plan.stripeAnnualPriceId,
        features: plan.features,
      },
      create: plan,
    });
  }

  console.log('✅ Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding: ', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
