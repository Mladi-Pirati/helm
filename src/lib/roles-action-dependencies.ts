import { db } from "@/db";
import {
  getCurrentUserHighestRoleRank,
  hasPermission,
} from "@/lib/auth/permissions";

export { db, getCurrentUserHighestRoleRank, hasPermission };
