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

export const createThemeSchema = {
  body: z.object({
    name: z.string().min(2, "Theme name must be at least 2 characters"),
    slug: z.string().min(2, "Slug must be at least 2 characters"),
    previewImageUrl: z.string().url().optional(),
    defaultConfig: z.preprocess(parseJsonString, z.record(z.string(), z.any()).optional()),
  }),
};

export const updateThemeSchema = {
  body: z.object({
    name: z.string().min(2, "Theme name must be at least 2 characters").optional(),
    slug: z.string().min(2, "Slug must be at least 2 characters").optional(),
    previewImageUrl: z.string().url().optional(),
    defaultConfig: z.preprocess(parseJsonString, z.record(z.string(), z.any()).optional()),
  }),
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID must be a number"),
  }),
};

export type CreateThemeDTO = z.infer<typeof createThemeSchema.body>;
export type UpdateThemeDTO = z.infer<typeof updateThemeSchema.body>;

