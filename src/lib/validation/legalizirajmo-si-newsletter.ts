import { z } from "zod";

export const legalizirajmoSiNewsletterSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email("A valid email address is required.")
      .transform((value) => value.toLowerCase()),
  })
  .passthrough();

export type LegalizirajmoSiNewsletterInput = z.infer<
  typeof legalizirajmoSiNewsletterSchema
>;
