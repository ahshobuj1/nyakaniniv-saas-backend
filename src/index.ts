// src/index.ts
import { IgnitorApp } from "./core/IgnitorApp";
import { AppLogger } from "./core/logging/logger";
import { config } from "./core/config";

// Providers (Infrastructure)
import { PrismaProvider } from "./providers/PrismaProvider";
import { FileUploaderProvider } from "./providers/FileUploaderProvider";
import { prisma } from "./lib/prisma";
import { AuthModule } from "./Modules/Auth/AuthModule";

import { TenantModule } from "./Modules/Tenant/TenantModule";
import { ThemeModule } from "./Modules/Theme/ThemeModule";
import { EventModule } from "./Modules/Event/EventModule";
import { SubscriptionModule } from "./Modules/Subscription/SubscriptionModule";
import { MixTapeModule } from "./Modules/MixTape/MixTapeModule";
import { BookingModule } from "./Modules/Booking/BookingModule";
import { InvoiceModule } from "./Modules/Invoice/InvoiceModule";
import { SupportTicketModule } from "./Modules/SupportTicket/SupportTicketModule";
import { NotificationModule } from "./Modules/Notification/NotificationModule";
import { LandingPageModule } from "./Modules/LandingPage/LandingPageModule";
import { UserModule } from "./Modules/User/UserModule";
import { WebhookModule } from "./Modules/Webhook/WebhookModule";
import { AnalyticsModule } from "./Modules/Analytics/AnalyticsModule";

// Modules (Business Logic)

async function bootstrap() {
  try {
    AppLogger.info("🗹 Starting application bootstrap");

    // 1. Initialize the Ignitor Engine
    const app = new IgnitorApp();

    // 2. Register Infrastructure Providers
    AppLogger.info("⚙ Registering infrastructure...");
    app.getContext().registerProvider("prisma", new PrismaProvider(prisma));
    app.getContext().registerProvider("fileUploader", new FileUploaderProvider());

    // 3. Register Application Modules
    AppLogger.info("⚙ Registering modules...");
    app.registerModule(new AuthModule());
    app.registerModule(new TenantModule());
    app.registerModule(new ThemeModule());
    app.registerModule(new EventModule());
    app.registerModule(new SubscriptionModule());
    app.registerModule(new MixTapeModule());
    app.registerModule(new BookingModule());
    app.registerModule(new InvoiceModule());
    app.registerModule(new SupportTicketModule());
    app.registerModule(new NotificationModule());
    app.registerModule(new LandingPageModule());
    app.registerModule(new UserModule());
    app.registerModule(new WebhookModule());
    app.registerModule(new AnalyticsModule());
    AppLogger.info("✔ All modules registered successfully");

    // 4. Spark the server!
    await app.spark(config.server.port);

    AppLogger.info("✷ Ignitor sparked successfully");
    AppLogger.info(`✔ Server is running on http://localhost:${config.server.port}`);
  } catch (error) {
    // Centralized Bootstrap Error Handling
    AppLogger.error("⬤ Failed to initialize application:", {
      error: error instanceof Error ? error : new Error(String(error)),
      context: "application-bootstrap",
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Start the application
bootstrap().catch((err) => {
  AppLogger.error("❌ Unhandled bootstrap error:", { error: err });
  process.exit(1);
});
