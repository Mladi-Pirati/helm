import { z } from "zod";

export const roleKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Key must be at least 2 characters long.")
  .max(80, "Key must be 80 characters or fewer.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and single hyphens only.",
  );

const roleDetailsSchema = {
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters long.")
    .max(120, "Name must be 120 characters or fewer."),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer.")
    .optional()
    .or(z.literal("")),
  rank: z
    .number()
    .int("Rank must be a whole number.")
    .positive("Rank must be a positive number."),
};

export const createRoleSchema = z.object({
  ...roleDetailsSchema,
  key: roleKeySchema,
});

export const updateRoleSchema = z.object(roleDetailsSchema);

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
