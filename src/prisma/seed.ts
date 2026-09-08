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

  // Seed Currencies
  const currencies = [
    { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', decimals: 2 },
    { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', decimals: 2 },
    { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵', decimals: 2 },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2 },
    { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', decimals: 0 },
    { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', decimals: 0 },
    { code: 'RWF', name: 'Rwandan Franc', symbol: 'FRw', decimals: 0 },
    { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  ];

  for (const c of currencies) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: { name: c.name, symbol: c.symbol, decimals: c.decimals, isActive: true },
      create: { code: c.code, name: c.name, symbol: c.symbol, decimals: c.decimals, isActive: true },
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
      previewImageUrl: 'https://additional-user.s3.eu-north-1.amazonaws.com/uploads/387c7d25-307e-47e1-aeca-0313af334094.png',
      defaultConfig: {},
    },
    {
      id: 3,
      name: 'Kenzo Theme',
      slug: 'kenzo',
      previewImageUrl: 'https://additional-user.s3.eu-north-1.amazonaws.com/uploads/08dcaa73-2f26-417d-894b-fbe3c9fbe26a.png',
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
