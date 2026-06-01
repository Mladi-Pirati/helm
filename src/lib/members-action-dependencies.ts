import { db } from "@/db";
import { syncMemberApplicationRoles } from "@/lib/application-access-sync";
import {
  getCurrentUserHighestRoleRank,
  getHighestRoleRank,
  hasPermission,
} from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { sendMembershipWelcomeEmail } from "@/lib/email/membership-approval";
import { createMembersKeycloakAdminClient } from "@/lib/members-keycloak";
import {
  memberHasActiveRole,
  roleGrantsAnyPermission,
} from "@/lib/members-query";

export {
  createMembersKeycloakAdminClient,
  db,
  getCurrentUser,
  getCurrentUserHighestRoleRank,
  getHighestRoleRank,
  hasPermission,
  memberHasActiveRole,
  roleGrantsAnyPermission,
  sendMembershipWelcomeEmail,
  syncMemberApplicationRoles,
};
