import { prisma } from '../lib/prisma';

const defaultFeaturesData = [
  {
    title: 'Personal DJ Website',
    description: 'Stop juggling tools. UpBeat Entertainment Africa brings everything together — your website, bookings, music, and payments.',
    order: 1,
  },
  {
    title: 'Booking Management',
    description: 'Handle every booking request like a pro. Confirm, negotiate, and schedule — all in one place.',
    order: 2,
  },
  {
    title: 'Invoicing & Payments',
    description: 'Auto-generate professional invoices with VAT support. Accept payments via Paystack, Flutterwave.',
    order: 3,
  },
  {
    title: 'Music & Mixtapes',
    description: 'Showcase your mixes and tracks directly on your website with a built-in audio player.',
    order: 4,
  },
  {
    title: 'Business Analytics',
    description: 'Track earnings, profile views, and booking trends. Know your numbers, grow your business.',
    order: 5,
  },
  {
    title: 'Mobile Optimised',
    description: 'Your website and dashboard work flawlessly on every device, from phones to desktops.',
    order: 6,
  },
];

const defaultSteps = [
  {
    title: 'Sign Up in 2 Minutes',
    description: 'Create your account, set your DJ name, and choose your plan. No credit card required for Starter.',
    imageUrl: '/home/feature/Feature1.png',
    order: 1,
  },
  {
    title: 'Customise Your Website',
    description: 'Pick a theme, add your bio, upload your mixes, and set your booking rates — your brand, your way.',
    imageUrl: '/home/feature/Feature2.png',
    order: 2,
  },
  {
    title: 'Share & Get Booked',
    description: 'Share your unique link everywhere. Clients visit, fill a booking form, and you confirm in your dashboard.',
    imageUrl: '/home/feature/Feature3.png',
    order: 3,
  },
];

const defaultFaqsData = [
  {
    question: '1. What is UpBeat Entertainment Africa and how does it work?',
    answer: 'UpBeat Entertainment Africa is a platform that helps DJs create their own professional website and manage their business in one place. After signing up, a DJ can choose a subscription plan and instantly get access to a personal dashboard.',
    order: 1,
  },
  {
    question: '2. Do I need coding skills to create my DJ website?',
    answer: 'No, you do not need any coding skills. Our platform provides easy-to-use templates and a simple editor so you can build your website effortlessly.',
    order: 2,
  },
  {
    question: '3. How do clients book me through the platform?',
    answer: 'Clients can visit your custom DJ website, view your availability, and submit booking requests directly. You will receive notifications in your dashboard to approve or decline them.',
    order: 3,
  },
  {
    question: '4. How does payment and invoicing work?',
    answer: 'We integrate with secure payment gateways. Once a booking is confirmed, clients can pay online. The funds are routed to your connected account, and automated invoices are generated.',
    order: 4,
  },
];

async function main() {
  console.log('Seeding Landing Page data...');

  // Hero
  const heroCount = await prisma.landingPageHero.count();
  if (heroCount === 0) {
    await prisma.landingPageHero.create({
      data: {
        title: 'Power Your DJ Brand Across Africa...',
        description: 'Get your personal website, manage bookings, and track payments — all in one platform designed for the African music industry.',
        imageUrl1: '/home/Hero.png',
        isActive: true,
      },
    });
    console.log('Hero created.');
  }

  // Features (Services)
  const serviceCount = await prisma.landingPageService.count();
  if (serviceCount === 0) {
    for (const service of defaultFeaturesData) {
      await prisma.landingPageService.create({
        data: service,
      });
    }
    console.log('Services created.');
  }

  // Steps
  const stepCount = await prisma.landingPageStep.count();
  if (stepCount === 0) {
    for (const step of defaultSteps) {
      await prisma.landingPageStep.create({
        data: step,
      });
    }
    console.log('Steps created.');
  }

  // FAQs
  const faqCount = await prisma.landingPageFaq.count();
  if (faqCount === 0) {
    for (const faq of defaultFaqsData) {
      await prisma.landingPageFaq.create({
        data: faq,
      });
    }
    console.log('FAQs created.');
  }

  console.log('Landing Page seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
