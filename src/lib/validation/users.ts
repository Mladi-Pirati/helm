import { z } from "zod";

import { USER_ROLES } from "@/db/schema";

export const updateUserSchema = z.object({
  role: z.enum(USER_ROLES),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
