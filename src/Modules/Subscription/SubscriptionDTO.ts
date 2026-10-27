import {z} from 'zod';

const parseJsonString = (val: unknown) => {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch (e) {
      return val;
    }
  }
  return val;
};

export const createSubscriptionPlanSchema = {
  body: z.object({
    name: z.string().min(2, 'Plan name must be at least 2 characters'),
    priceMonthly: z.number().min(0, 'Price must be positive'),
    priceAnnually: z.number().min(0, 'Price must be positive'),
    discountPercentage: z.number().min(0).max(100).optional().default(0),
    isActive: z.boolean().optional().default(true),
    features: z.preprocess(
      parseJsonString,
      z.record(z.string(), z.any()).optional(),
    ),
  }),
};

export const updateSubscriptionPlanSchema = {
  body: z.object({
    name: z
      .string()
      .min(2, 'Plan name must be at least 2 characters')
      .optional(),
    priceMonthly: z.number().min(0, 'Price must be positive').optional(),
    priceAnnually: z.number().min(0, 'Price must be positive').optional(),
    discountPercentage: z.number().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
    features: z.preprocess(
      parseJsonString,
      z.record(z.string(), z.any()).optional(),
    ),
  }),
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number'),
  }),
};

export const subscribeSchema = {
  body: z.object({
    planId: z.number(),
    billingCycle: z.enum(['monthly', 'annually']),
    currency: z.string().min(3).max(10).optional(),
    successUrl: z.string().url('Must be a valid URL').optional(),
    cancelUrl: z.string().url('Must be a valid URL').optional(),
    gateway: z
      .enum([
        'paystack',
        'pesapal',
        'flutterwave',
        'PAYSTACK',
        'PESAPAL',
        'FLUTTERWAVE',
      ])
      .optional(),
  }),
};

export const previewUpgradeSchema = {
  query: z.object({
    planId: z.string().regex(/^\d+$/, 'planId must be a valid number'),
    billingCycle: z.enum(['monthly', 'annually']),
    currency: z.string().min(3).max(10).optional(),
  }),
};

export const setPlanPriceSchema = {
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number'),
    currencyCode: z.string().min(3).max(10).optional(),
  }),
  body: z.object({
    currencyCode: z.string().min(3).max(10).optional(),
    priceMonthly: z.number().min(0, 'Monthly price must be positive'),
    priceAnnually: z.number().min(0, 'Annual price must be positive'),
    isActive: z.boolean().optional(),
  }),
};

export const toggleCurrencySchema = {
  params: z.object({
    code: z.string().min(3).max(10),
  }),
  body: z.object({
    isActive: z.boolean(),
  }),
};

export type CreateSubscriptionPlanDTO = z.infer<
  typeof createSubscriptionPlanSchema.body
>;
export type UpdateSubscriptionPlanDTO = z.infer<
  typeof updateSubscriptionPlanSchema.body
>;
export type SubscribeDTO = z.infer<typeof subscribeSchema.body>;
export type PreviewUpgradeDTO = {
  planId: number;
  billingCycle: 'monthly' | 'annually';
  currency?: string;
};
export type SetPlanPriceDTO = z.infer<typeof setPlanPriceSchema.body>;
export type ToggleCurrencyDTO = z.infer<typeof toggleCurrencySchema.body>;
