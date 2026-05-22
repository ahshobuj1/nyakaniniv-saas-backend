import { z } from 'zod';

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
    name: z.string().min(2, "Plan name must be at least 2 characters"),
    priceMonthly: z.number().min(0, "Price must be positive"),
    priceAnnually: z.number().min(0, "Price must be positive"),
    stripeMonthlyPriceId: z.string().optional(),
    stripeAnnualPriceId: z.string().optional(),
    discountPercentage: z.number().min(0).max(100).optional().default(0),
    features: z.preprocess(parseJsonString, z.record(z.string(), z.any()).optional()),
  }),
};

export const updateSubscriptionPlanSchema = {
  body: z.object({
    name: z.string().min(2, "Plan name must be at least 2 characters").optional(),
    priceMonthly: z.number().min(0, "Price must be positive").optional(),
    priceAnnually: z.number().min(0, "Price must be positive").optional(),
    stripeMonthlyPriceId: z.string().optional(),
    stripeAnnualPriceId: z.string().optional(),
    discountPercentage: z.number().min(0).max(100).optional(),
    features: z.preprocess(parseJsonString, z.record(z.string(), z.any()).optional()),
  }),
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID must be a number"),
  }),
};

export const subscribeSchema = {
  body: z.object({
    planId: z.number(),
    billingCycle: z.enum(['monthly', 'annually']),
    successUrl: z.string().url("Must be a valid URL").optional(),
    cancelUrl: z.string().url("Must be a valid URL").optional(),
  }),
};

export type CreateSubscriptionPlanDTO = z.infer<typeof createSubscriptionPlanSchema.body>;
export type UpdateSubscriptionPlanDTO = z.infer<typeof updateSubscriptionPlanSchema.body>;
export type SubscribeDTO = z.infer<typeof subscribeSchema.body>;
