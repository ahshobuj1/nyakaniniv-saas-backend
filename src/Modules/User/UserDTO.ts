import { z } from 'zod';
import { UserRole } from '@/prisma/generated/client';

export const UpdateProfileDTOSchema = {
  body: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    profileImg: z.string().optional(),
  })
};

export const UpdateUserStatusDTOSchema = {
  body: z.object({
    isVerified: z.boolean().optional(),
  })
};

export const UpdateUserRoleDTOSchema = {
  body: z.object({
    role: z.nativeEnum(UserRole),
  })
};

export type UpdateProfileDTO = z.infer<typeof UpdateProfileDTOSchema.body>;
export type UpdateUserStatusDTO = z.infer<typeof UpdateUserStatusDTOSchema.body>;
export type UpdateUserRoleDTO = z.infer<typeof UpdateUserRoleDTOSchema.body>;
