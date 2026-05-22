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

export const createMixTapeSchema = {
  body: z.object({
    title: z.string().min(2, "Title must be at least 2 characters"),
    audioUrl: z.string().url("Must be a valid URL"),
    order: z.preprocess((val) => Number(val), z.number().int().optional()),
  }),
};

export const updateMixTapeSchema = {
  body: z.object({
    title: z.string().min(2, "Title must be at least 2 characters").optional(),
    audioUrl: z.string().url("Must be a valid URL").optional(),
    order: z.preprocess((val) => Number(val), z.number().int().optional()),
  }),
  params: z.object({
    id: z.string().uuid("Invalid MixTape ID"),
  }),
};

export const reorderMixTapesSchema = {
  body: z.object({
    orders: z.array(z.object({
      id: z.string().uuid("Invalid MixTape ID"),
      order: z.number().int(),
    })),
  }),
};

export type CreateMixTapeDTO = z.infer<typeof createMixTapeSchema.body>;
export type UpdateMixTapeDTO = z.infer<typeof updateMixTapeSchema.body>;
export type ReorderMixTapesDTO = z.infer<typeof reorderMixTapesSchema.body>;
