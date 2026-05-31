import { z } from "zod";

export const moduleKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Key must be at least 2 characters long.")
  .max(80, "Key must be 80 characters or fewer.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and single hyphens only.",
  );

const moduleDetailsSchema = {
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
};

export const createModuleSchema = z.object({
  ...moduleDetailsSchema,
  key: moduleKeySchema,
});

export const updateModuleSchema = z.object(moduleDetailsSchema);

export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
