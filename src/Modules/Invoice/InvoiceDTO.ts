import { z } from 'zod';

export const payInvoiceSchema = {
  body: z.object({
    successUrl: z.string().url("Must be a valid URL").optional(),
    cancelUrl: z.string().url("Must be a valid URL").optional(),
  }),
  params: z.object({
    id: z.string().uuid("Invalid Invoice ID"),
  }),
};

export type PayInvoiceDTO = z.infer<typeof payInvoiceSchema.body>;
