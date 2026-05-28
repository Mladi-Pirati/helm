import { z } from "zod";

export const permissionActionSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Action must be at least 2 characters long.")
  .max(80, "Action must be 80 characters or fewer.")
  .regex(/^[a-z_]+$/, "Use lowercase letters and underscores only.");

const permissionDetailsSchema = {
  moduleId: z.string().uuid("Please select a module."),
  action: permissionActionSchema,
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer.")
    .optional()
    .or(z.literal("")),
};

export const createPermissionSchema = z.object(permissionDetailsSchema);

export const updatePermissionSchema = z.object({
  description: permissionDetailsSchema.description,
});

export type CreatePermissionInput = z.infer<typeof createPermissionSchema>;
export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>;
