import { prisma } from '@/lib/prisma';

async function main() {
  console.log('Seeding Database...');

  // Subscription Plans
  const plans = [
    {
      id: 1,
      name: 'Starter',
      priceMonthly: 500.00,
      priceAnnually: 5000.00,
      discountPercentage: 16,
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
      priceMonthly: 750.00,
      priceAnnually: 7500.00,
      discountPercentage: 16,
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
      priceMonthly: 950.00,
      priceAnnually: 9500.00,
      discountPercentage: 16,
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
        features: plan.features,
      },
      create: plan,
    });
  }

  // Seed Currencies (African & Global)
  const currencies = [
    { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', decimals: 2, isActive: true },
    { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2, isActive: true },
    { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', decimals: 2, isActive: true },
    { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵', decimals: 2, isActive: true },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2, isActive: true },
    { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', decimals: 0, isActive: true },
    { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', decimals: 0, isActive: true },
    { code: 'RWF', name: 'Rwandan Franc', symbol: 'FRw', decimals: 0, isActive: true },
    { code: 'XOF', name: 'West African CFA Franc', symbol: 'CFA', decimals: 0, isActive: false },
    { code: 'XAF', name: 'Central African CFA Franc', symbol: 'FCFA', decimals: 0, isActive: false },
    { code: 'ZMW', name: 'Zambian Kwacha', symbol: 'ZK', decimals: 2, isActive: false },
  ];

  for (const c of currencies) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: { name: c.name, symbol: c.symbol, decimals: c.decimals, isActive: c.isActive },
      create: { code: c.code, name: c.name, symbol: c.symbol, decimals: c.decimals, isActive: c.isActive },
    });
  }

  // Seed Subscription Plan Prices for enabled currencies
  const planPrices = [
    // Starter (Plan 1)
    { planId: 1, currencyCode: 'KES', priceMonthly: 500.0, priceAnnually: 5000.0, isActive: true },
    { planId: 1, currencyCode: 'USD', priceMonthly: 5.0, priceAnnually: 50.0, isActive: true },
    { planId: 1, currencyCode: 'ZAR', priceMonthly: 90.0, priceAnnually: 900.0, isActive: true },
    { planId: 1, currencyCode: 'GHS', priceMonthly: 75.0, priceAnnually: 750.0, isActive: true },
    { planId: 1, currencyCode: 'NGN', priceMonthly: 7500.0, priceAnnually: 75000.0, isActive: true },
    { planId: 1, currencyCode: 'UGX', priceMonthly: 19000.0, priceAnnually: 190000.0, isActive: true },
    { planId: 1, currencyCode: 'TZS', priceMonthly: 13000.0, priceAnnually: 130000.0, isActive: true },
    { planId: 1, currencyCode: 'RWF', priceMonthly: 6500.0, priceAnnually: 65000.0, isActive: true },

    // Pro (Plan 2)
    { planId: 2, currencyCode: 'KES', priceMonthly: 750.0, priceAnnually: 7500.0, isActive: true },
    { planId: 2, currencyCode: 'USD', priceMonthly: 7.0, priceAnnually: 70.0, isActive: true },
    { planId: 2, currencyCode: 'ZAR', priceMonthly: 130.0, priceAnnually: 1300.0, isActive: true },
    { planId: 2, currencyCode: 'GHS', priceMonthly: 110.0, priceAnnually: 1100.0, isActive: true },
    { planId: 2, currencyCode: 'NGN', priceMonthly: 11000.0, priceAnnually: 110000.0, isActive: true },
    { planId: 2, currencyCode: 'UGX', priceMonthly: 27000.0, priceAnnually: 270000.0, isActive: true },
    { planId: 2, currencyCode: 'TZS', priceMonthly: 18500.0, priceAnnually: 185000.0, isActive: true },
    { planId: 2, currencyCode: 'RWF', priceMonthly: 9500.0, priceAnnually: 95000.0, isActive: true },

    // Elite (Plan 3)
    { planId: 3, currencyCode: 'KES', priceMonthly: 950.0, priceAnnually: 9500.0, isActive: true },
    { planId: 3, currencyCode: 'USD', priceMonthly: 9.0, priceAnnually: 90.0, isActive: true },
    { planId: 3, currencyCode: 'ZAR', priceMonthly: 170.0, priceAnnually: 1700.0, isActive: true },
    { planId: 3, currencyCode: 'GHS', priceMonthly: 140.0, priceAnnually: 1400.0, isActive: true },
    { planId: 3, currencyCode: 'NGN', priceMonthly: 14000.0, priceAnnually: 140000.0, isActive: true },
    { planId: 3, currencyCode: 'UGX', priceMonthly: 35000.0, priceAnnually: 350000.0, isActive: true },
    { planId: 3, currencyCode: 'TZS', priceMonthly: 24000.0, priceAnnually: 240000.0, isActive: true },
    { planId: 3, currencyCode: 'RWF', priceMonthly: 12500.0, priceAnnually: 125000.0, isActive: true },
  ];

  for (const pp of planPrices) {
    await prisma.subscriptionPlanPrice.upsert({
      where: {
        planId_currencyCode: {
          planId: pp.planId,
          currencyCode: pp.currencyCode,
        },
      },
      update: {
        priceMonthly: pp.priceMonthly,
        priceAnnually: pp.priceAnnually,
        isActive: pp.isActive,
      },
      create: pp,
    });
  }

  // Seed African Countries
  const countries = [
    { code: 'KE', name: 'Kenya', currencyCode: 'KES', timezone: 'Africa/Nairobi' },
    { code: 'NG', name: 'Nigeria', currencyCode: 'NGN', timezone: 'Africa/Lagos' },
    { code: 'GH', name: 'Ghana', currencyCode: 'GHS', timezone: 'Africa/Accra' },
    { code: 'ZA', name: 'South Africa', currencyCode: 'ZAR', timezone: 'Africa/Johannesburg' },
    { code: 'UG', name: 'Uganda', currencyCode: 'UGX', timezone: 'Africa/Kampala' },
    { code: 'TZ', name: 'Tanzania', currencyCode: 'TZS', timezone: 'Africa/Dar_es_Salaam' },
    { code: 'RW', name: 'Rwanda', currencyCode: 'RWF', timezone: 'Africa/Kigali' },
  ];

  for (const country of countries) {
    await prisma.country.upsert({
      where: { code: country.code },
      update: { name: country.name, currencyCode: country.currencyCode, timezone: country.timezone, isActive: true },
      create: { code: country.code, name: country.name, currencyCode: country.currencyCode, timezone: country.timezone, isActive: true },
    });
  }

  // Seed Themes
  const themes = [
    {
      id: 1,
      name: 'Azura Theme',
      slug: 'azura',
      previewImageUrl: '/theme/Theme1.png',
      defaultConfig: {},
    },
    {
      id: 3,
      name: 'Kenzo Theme',
      slug: 'kenzo',
      previewImageUrl: '/theme/Theme2.png',
      defaultConfig: {},
    },
  ];

  for (const theme of themes) {
    await prisma.theme.upsert({
      where: { id: theme.id },
      update: {
        name: theme.name,
        slug: theme.slug,
        previewImageUrl: theme.previewImageUrl,
        defaultConfig: theme.defaultConfig,
      },
      create: {
        id: theme.id,
        name: theme.name,
        slug: theme.slug,
        previewImageUrl: theme.previewImageUrl,
        defaultConfig: theme.defaultConfig,
      },
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
