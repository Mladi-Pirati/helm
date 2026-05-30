import { z } from "zod";

const optionalText = (max = 500) =>
  z.string().trim().max(max).optional().or(z.literal(""));

const keycloakIdentifierSchema = (field: string) =>
  z
    .string()
    .trim()
    .min(1, `${field} is required.`)
    .max(255, `${field} must be 255 characters or fewer.`);

const applicationDetailsSchema = {
  description: optionalText(),
  keycloakClientId: keycloakIdentifierSchema("Client id"),
  keycloakRoleName: keycloakIdentifierSchema("Client role"),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters long.")
    .max(120, "Name must be 120 characters or fewer."),
};

export const createAccessApplicationSchema = z.object(applicationDetailsSchema);
export const updateAccessApplicationSchema = z.object(applicationDetailsSchema);

export const applicationAccessAssignmentSchema = z.object({
  applicationId: keycloakIdentifierSchema("Application"),
  assigned: z.boolean(),
});

export const keycloakClientSearchSchema = z.object({
  q: z.string().trim().min(1).max(120),
});

export const keycloakClientRolesInputSchema = z.object({
  clientId: keycloakIdentifierSchema("Client id"),
});

export type CreateAccessApplicationInput = z.infer<
  typeof createAccessApplicationSchema
>;
export type UpdateAccessApplicationInput = z.infer<
  typeof updateAccessApplicationSchema
>;
export type ApplicationAccessAssignmentInput = z.infer<
  typeof applicationAccessAssignmentSchema
>;
