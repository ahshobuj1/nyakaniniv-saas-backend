import { z } from 'zod';

export const createHeroSchema = {
  body: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
};

export const createStepSchema = {
  body: z.object({
    title: z.string().min(2),
    description: z.string().optional(),
    order: z.number().int().optional(),
  }),
};

export const createServiceSchema = {
  body: z.object({
    title: z.string().min(2),
    description: z.string().optional(),
    order: z.number().int().optional(),
  }),
};

export const createFaqSchema = {
  body: z.object({
    question: z.string().min(5),
    answer: z.string().min(5),
    order: z.number().int().optional(),
  }),
};

export const createMarqueeSchema = {
  body: z.object({
    order: z.number().int().optional(),
  }),
};

export type CreateHeroDTO = z.infer<typeof createHeroSchema.body>;
export type CreateStepDTO = z.infer<typeof createStepSchema.body>;
export type CreateServiceDTO = z.infer<typeof createServiceSchema.body>;
export type CreateFaqDTO = z.infer<typeof createFaqSchema.body>;
export type CreateMarqueeDTO = z.infer<typeof createMarqueeSchema.body>;
