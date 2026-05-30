import { createKeycloakAdminClient } from "@/lib/keycloak/admin-client";

export function createMembersKeycloakAdminClient() {
  return createKeycloakAdminClient();
}
