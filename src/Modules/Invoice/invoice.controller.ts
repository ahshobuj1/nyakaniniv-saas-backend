import { Request, Response } from 'express';
import { BaseController } from '@/core/BaseController';
import { InvoiceServices } from './invoice.service';

export class InvoiceController extends BaseController {
  constructor(private invoiceService: InvoiceServices) {
    super();
  }

  public async getMyInvoices(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { invoices, meta } = await this.invoiceService.getMyInvoices(userId, req.query);
    this.sendPaginatedResponse(req, res, meta, 'Invoices retrieved successfully', invoices);
  }

  public async getInvoiceById(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const invoice = await this.invoiceService.getInvoiceById(userId, id);
    this.sendResponse(req, res, 'Invoice retrieved successfully', undefined, invoice);
  }

  public async getAllInvoices(req: Request, res: Response): Promise<void> {
    const { invoices, meta } = await this.invoiceService.getAllInvoices(req.query);
    this.sendPaginatedResponse(req, res, meta, 'All invoices retrieved successfully', invoices);
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

  public async downloadInvoicePdf(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const pdfBuffer = await this.invoiceService.generateInvoicePdf(id);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${id}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  }
}
