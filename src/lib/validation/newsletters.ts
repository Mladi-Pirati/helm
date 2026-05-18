import { z } from "zod";

export const newsletterSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Slug must be at least 2 characters long.")
  .max(80, "Slug must be 80 characters or fewer.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and single hyphens only.",
  );

const newsletterDetailsSchema = {
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters long.")
    .max(120, "Name must be 120 characters or fewer."),
  description: z
    .string()
    .trim()
    .min(2, "Description must be at least 2 characters long.")
    .max(500, "Description must be 500 characters or fewer."),
};

export const createNewsletterSchema = z.object({
  ...newsletterDetailsSchema,
  slug: newsletterSlugSchema,
});

export const updateNewsletterSchema = z.object(newsletterDetailsSchema);

export const newsletterSubscriptionSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email("A valid email address is required.")
      .transform((value) => value.toLowerCase()),
  })
  .passthrough();

export type CreateNewsletterInput = z.infer<typeof createNewsletterSchema>;
export type UpdateNewsletterInput = z.infer<typeof updateNewsletterSchema>;
export type NewsletterSubscriptionInput = z.infer<
  typeof newsletterSubscriptionSchema
>;
