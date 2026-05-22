import { Request, Response } from 'express';
import { BaseController } from '@/core/BaseController';
import { InvoiceServices } from './invoice.service';

export class InvoiceController extends BaseController {
  constructor(private invoiceService: InvoiceServices) {
    super();
  }

  public async getMyInvoices(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const invoices = await this.invoiceService.getMyInvoices(userId);
    this.sendResponse(req, res, 'Invoices retrieved successfully', undefined, invoices);
  }

  public async getAllInvoices(req: Request, res: Response): Promise<void> {
    const invoices = await this.invoiceService.getAllInvoices();
    this.sendResponse(req, res, 'All invoices retrieved successfully', undefined, invoices);
  }

  public async payInvoice(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const result = await this.invoiceService.payInvoice(id, req.body);
    this.sendResponse(req, res, 'Payment intent created successfully', undefined, result);
  }

  public async markAsPaid(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const invoice = await this.invoiceService.markAsPaid(userId, id);
    this.sendResponse(req, res, 'Invoice marked as paid', undefined, invoice);
  }
}
