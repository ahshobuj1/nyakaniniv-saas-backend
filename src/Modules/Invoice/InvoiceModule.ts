import { BaseModule } from "@/core/BaseModule";
import { AppLogger } from "@/core/logging/logger";
import { InvoiceServices } from "./invoice.service";
import { InvoiceController } from "./invoice.controller";
import { validateRequest } from "@/middleware/validation";
import { authenticateUser, authorizeRole } from "@/middleware/auth";
import { UserRole } from "@/prisma/generated/client";
import {
  payInvoiceSchema,
} from "./InvoiceDTO";

export class InvoiceModule extends BaseModule {
  public name: string = "InvoiceModule";
  public version: string = "1.0.0";
  public basePath: string = "/invoices/v1/";
  public dependencies?: string[] | undefined;

  private logger = new AppLogger("InvoiceModule");

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService("prisma");
    const emailProvider = this.context.getService("email");
    this.registerService("InvoiceService", new InvoiceServices(prisma, emailProvider));
  }

  protected async setupControllers(): Promise<void> {
    const invoiceService = this.getService<InvoiceServices>("InvoiceService");
    this.registerController("InvoiceController", new InvoiceController(invoiceService));
  }

  protected async setupRoutes(): Promise<void> {
    const controller = this.getController<InvoiceController>("InvoiceController");

    // Admin Routes
    this.router.get(
      "/all",
      authenticateUser,
      authorizeRole([UserRole.SUPER_ADMIN]),
      controller.getAllInvoices.bind(controller),
    );

    // DJ Routes
    this.router.get(
      "/my-invoices",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      controller.getMyInvoices.bind(controller),
    );

    this.router.patch(
      "/:id/mark-paid",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      controller.markAsPaid.bind(controller),
    );

    // Public / Client Route (Paying a booking invoice)
    this.router.post(
      "/:id/pay",
      validateRequest(payInvoiceSchema),
      controller.payInvoice.bind(controller),
    );
  }
}
