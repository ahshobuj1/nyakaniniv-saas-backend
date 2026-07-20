// src/Modules/Tenant/TenantDTO.ts
import { z } from "zod";

export const createTenantSchema = {
  body: z.object({
    subdomain: z
      .string()
      .min(3, "Subdomain must be at least 3 characters")
      .max(63, "Subdomain must be at most 63 characters")
      .regex(/^[a-z0-9-]+$/, "Subdomain can only contain lowercase letters, numbers, and hyphens")
      .refine(
        (val) => !["admin", "api", "app", "www", "devscout", "dashboard"].includes(val),
        "This subdomain is reserved",
      ),
    stageName: z.string().min(1, "Stage name is required"),
    country: z.string().min(1, "Country is required"),
    city: z.string().min(1, "City is required"),
    genres: z.array(z.string()).max(4, "You can select up to 4 genres").optional(),
  }),
};

export const updateTenantSchema = {
  body: z.object({
    stageName: z.string().min(1, "Stage name is required").optional(),
    country: z.string().min(1, "Country is required").optional(),
    city: z.string().min(1, "City is required").optional(),
    genres: z.array(z.string()).max(4, "You can select up to 4 genres").optional(),
    bio: z.string().optional(),
    logoUrl: z.string().url("Invalid URL format").optional(),
    timezone: z.string().optional(),
    socialLinks: z
      .object({
        facebook: z.string().optional().or(z.literal("")),
        instagram: z.string().optional().or(z.literal("")),
        linkedin: z.string().optional().or(z.literal("")),
        twitter: z.string().optional().or(z.literal("")),
        soundcloud: z.string().optional().or(z.literal("")),
        mixcloud: z.string().optional().or(z.literal("")),
      })
      .optional(),
  }),
};

export const assignThemeSchema = {
  body: z.object({
    themeSlug: z.string(),
    config: z.any().optional(),
  }),
};

export const updateTenantStatusSchema = {
  body: z.object({
    isActive: z.boolean(),
  }),
};

export type CreateTenantDTO = z.infer<typeof createTenantSchema.body>;
export type UpdateTenantDTO = z.infer<typeof updateTenantSchema.body>;
export type AssignThemeDTO = z.infer<typeof assignThemeSchema.body>;
export type UpdateTenantStatusDTO = z.infer<typeof updateTenantStatusSchema.body>;
