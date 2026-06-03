import axios, { type AxiosAdapter, type AxiosInstance } from "axios";
import { z } from "zod";

import { getKeycloakUserDisplayName } from "@/lib/auth/keycloak-access";

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_CLIENT_ROLE_NAME = "user";

const keycloakAdminEnvSchema = z.object({
  KEYCLOAK_CLIENT_ID: z.string().trim().min(1),
  KEYCLOAK_CLIENT_SECRET: z.string().trim().min(1),
  KEYCLOAK_ISSUER: z.string().trim().url(),
  KEYCLOAK_ADMIN: z.string().trim().url().optional(),
  KEYCLOAK_REALM: z.string().trim().min(1).optional(),
});

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
});

const keycloakUserSchema = z
  .object({
    id: z.string().min(1),
    username: z.string().min(1),
    email: z.string().nullable().optional(),
    enabled: z.boolean().optional(),
    emailVerified: z.boolean().optional(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
  })
  .transform((user) => ({
    email: user.email ?? null,
    enabled: user.enabled ?? true,
    emailVerified: user.emailVerified ?? false,
    firstName: user.firstName ?? null,
    fullName: getKeycloakUserDisplayName({
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      username: user.username,
    }),
    id: user.id,
    lastName: user.lastName ?? null,
    username: user.username,
  }));

const keycloakUsersResponseSchema = z.array(keycloakUserSchema);
const keycloakUserRepresentationSchema = z
  .object({
    id: z.string().min(1),
    username: z.string().min(1),
    email: z.string().nullable().optional(),
    enabled: z.boolean().optional(),
    emailVerified: z.boolean().optional(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
  })
  .passthrough();

const keycloakClientSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
});

const keycloakClientsResponseSchema = z.array(keycloakClientSchema);

const keycloakRoleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

const keycloakRolesResponseSchema = z.array(keycloakRoleSchema);

export type KeycloakAdminConfig = {
  adminBaseUrl: string;
  clientId: string;
  clientSecret: string;
  defaultClientRoleName: string;
  issuer: string;
  realm: string;
};

export type KeycloakUser = z.infer<typeof keycloakUserSchema>;
export type KeycloakClient = z.infer<typeof keycloakClientSchema>;
export type KeycloakClientRole = z.infer<typeof keycloakRoleSchema>;
export type KeycloakClientRoleAssignment = {
  clientId: string;
  roleName: string;
};
export type KeycloakUserProfileUpdate = {
  email: string | null;
  firstName: string;
  lastName: string;
  username: string;
};
export type KeycloakUserCreate = {
  email: string;
  firstName: string;
  lastName: string;
  username: string;
};
export type KeycloakRequiredAction = "UPDATE_PASSWORD" | "VERIFY_EMAIL";

export class KeycloakAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeycloakAdminError";
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function encodeRealmPathPart(value: string) {
  return value
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export function getKeycloakAdminConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): KeycloakAdminConfig {
  const parsed = keycloakAdminEnvSchema.parse(env);
  const issuer = trimTrailingSlash(parsed.KEYCLOAK_ISSUER);
  const issuerUrl = new URL(issuer);
  const realmMarker = "/realms/";
  const realmMarkerIndex = issuerUrl.pathname.indexOf(realmMarker);

  if (realmMarkerIndex === -1 && !parsed.KEYCLOAK_REALM) {
    throw new KeycloakAdminError(
      "KEYCLOAK_ISSUER must include the realm path, for example https://host/realms/realm.",
    );
  }

  const realm =
    parsed.KEYCLOAK_REALM ??
    decodeURIComponent(
      issuerUrl.pathname.slice(realmMarkerIndex + realmMarker.length),
    );

  if (!realm) {
    throw new KeycloakAdminError("KEYCLOAK_ISSUER must include a realm name.");
  }

  const issuerPrefix =
    realmMarkerIndex === -1
      ? ""
      : issuerUrl.pathname.slice(0, realmMarkerIndex);
  const adminBaseUrl =
    parsed.KEYCLOAK_ADMIN?.replace(/\/+$/, "") ??
    `${issuerUrl.origin}${issuerPrefix}/admin/realms/${encodeRealmPathPart(realm)}`;

  return {
    adminBaseUrl,
    clientId: parsed.KEYCLOAK_CLIENT_ID,
    clientSecret: parsed.KEYCLOAK_CLIENT_SECRET,
    defaultClientRoleName:
      env.KEYCLOAK_DEFAULT_CLIENT_ROLE?.trim() || DEFAULT_CLIENT_ROLE_NAME,
    issuer,
    realm,
  };
}

type KeycloakAdminClientOptions = {
  adapter?: AxiosAdapter;
  pageSize?: number;
};

export function createKeycloakAdminClient(
  config = getKeycloakAdminConfigFromEnv(),
  options: KeycloakAdminClientOptions = {},
) {
  return new KeycloakAdminClient(config, options);
}

class KeycloakAdminClient {
  private accessToken: string | null = null;
  private clientUuid: string | null = null;
  private readonly http: AxiosInstance;
  private readonly pageSize: number;

  constructor(
    private readonly config: KeycloakAdminConfig,
    options: KeycloakAdminClientOptions,
  ) {
    this.pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    this.http = axios.create({
      adapter: options.adapter,
    });
  }

  async listUsers() {
    const users: Array<KeycloakUser> = [];
    let first = 0;

    while (true) {
      const response = await this.get(`${this.config.adminBaseUrl}/users`, {
        briefRepresentation: false,
        first,
        max: this.pageSize,
      });
      const page = keycloakUsersResponseSchema.parse(response);

      users.push(...page);

      if (page.length < this.pageSize) {
        return users;
      }

      first += this.pageSize;
    }
  }

  async searchUsers(query: string, max = 10) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return [];

    const baseParams = {
      briefRepresentation: false,
      first: 0,
      max,
    } as const;
    const queryResults = await Promise.all([
      this.get(`${this.config.adminBaseUrl}/users`, {
        ...baseParams,
        search: trimmedQuery,
      }),
      this.get(`${this.config.adminBaseUrl}/users`, {
        ...baseParams,
        exact: true,
        username: trimmedQuery,
      }),
      this.get(`${this.config.adminBaseUrl}/users`, {
        ...baseParams,
        exact: true,
        email: trimmedQuery,
      }),
    ]);
    const usersById = new Map<string, KeycloakUser>();

    for (const result of queryResults) {
      for (const user of keycloakUsersResponseSchema.parse(result)) {
        usersById.set(user.id, user);
      }
    }

    return Array.from(usersById.values()).slice(0, max);
  }

  async searchUsersByUsername(username: string, max = 10) {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) return [];

    return keycloakUsersResponseSchema.parse(
      await this.get(`${this.config.adminBaseUrl}/users`, {
        briefRepresentation: false,
        exact: true,
        first: 0,
        max,
        username: trimmedUsername,
      }),
    );
  }

  async findUserByEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return null;

    return this.findExactUser({
      email: normalizedEmail,
    });
  }

  async findUserByUsername(username: string) {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) return null;

    return this.findExactUser({
      username: trimmedUsername,
    });
  }

  async getUser(userId: string) {
    return keycloakUserSchema.parse(await this.getUserRepresentation(userId));
  }

  async createUser(values: KeycloakUserCreate) {
    const response = await this.post(`${this.config.adminBaseUrl}/users`, {
      email: values.email,
      emailVerified: false,
      enabled: true,
      firstName: values.firstName,
      lastName: values.lastName,
      username: values.username,
    });
    const location = getHeaderValue(response.headers, "location");
    const userId = location ? location.split("/").filter(Boolean).at(-1) : null;

    if (userId) {
      return this.getUser(userId);
    }

    const createdUser =
      (await this.findUserByEmail(values.email)) ??
      (await this.findUserByUsername(values.username));

    if (!createdUser) {
      throw new KeycloakAdminError(
        "Created Keycloak user could not be resolved.",
      );
    }

    return createdUser;
  }

  async updateUserProfile(userId: string, values: KeycloakUserProfileUpdate) {
    const currentUser = await this.getUserRepresentation(userId);
    const emailChanged = (currentUser.email ?? null) !== values.email;

    await this.put(
      `${this.config.adminBaseUrl}/users/${encodeURIComponent(userId)}`,
      {
        ...currentUser,
        ...values,
        ...(emailChanged ? { emailVerified: false } : {}),
      },
    );
  }

  async deleteUser(userId: string) {
    await this.delete(
      `${this.config.adminBaseUrl}/users/${encodeURIComponent(userId)}`,
    );
  }

  async sendRequiredActionsEmail(
    userId: string,
    actions: Array<KeycloakRequiredAction>,
  ) {
    await this.put(
      `${this.config.adminBaseUrl}/users/${encodeURIComponent(
        userId,
      )}/execute-actions-email`,
      actions,
    );
  }

  async listClientRoles(userId: string) {
    const clientUuid = await this.getClientUuid();

    return keycloakRolesResponseSchema.parse(
      await this.get(
        `${this.config.adminBaseUrl}/users/${encodeURIComponent(
          userId,
        )}/role-mappings/clients/${encodeURIComponent(clientUuid)}`,
      ),
    );
  }

  async searchClients(query: string, max = 20) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return [];

    return keycloakClientsResponseSchema
      .parse(
        await this.get(`${this.config.adminBaseUrl}/clients`, {
          clientId: trimmedQuery,
          first: 0,
          max,
        }),
      )
      .slice(0, max);
  }

  async listRolesForClient(clientId: string) {
    const clientUuid = await this.getClientUuidByClientId(clientId);

    return keycloakRolesResponseSchema.parse(
      await this.get(
        `${this.config.adminBaseUrl}/clients/${encodeURIComponent(
          clientUuid,
        )}/roles`,
      ),
    );
  }

  async addClientRole(
    userId: string,
    assignment: KeycloakClientRoleAssignment,
  ) {
    const { clientUuid, role } =
      await this.getClientRoleForAssignment(assignment);

    await this.post(
      `${this.config.adminBaseUrl}/users/${encodeURIComponent(
        userId,
      )}/role-mappings/clients/${encodeURIComponent(clientUuid)}`,
      [role],
    );
  }

  async removeClientRole(
    userId: string,
    assignment: KeycloakClientRoleAssignment,
  ) {
    const { clientUuid, role } =
      await this.getClientRoleForAssignment(assignment);

    await this.delete(
      `${this.config.adminBaseUrl}/users/${encodeURIComponent(
        userId,
      )}/role-mappings/clients/${encodeURIComponent(clientUuid)}`,
      [role],
    );
  }

  async hasAnyClientRole(userId: string) {
    return (await this.listClientRoles(userId)).length > 0;
  }

  async ensureDefaultClientRole(userId: string) {
    const roles = await this.listClientRoles(userId);

    if (roles.some((role) => role.name === this.config.defaultClientRoleName)) {
      return;
    }

    const clientUuid = await this.getClientUuid();
    const role = keycloakRoleSchema.parse(
      await this.get(
        `${this.config.adminBaseUrl}/clients/${encodeURIComponent(
          clientUuid,
        )}/roles/${encodeURIComponent(this.config.defaultClientRoleName)}`,
      ),
    );

    await this.post(
      `${this.config.adminBaseUrl}/users/${encodeURIComponent(
        userId,
      )}/role-mappings/clients/${encodeURIComponent(clientUuid)}`,
      [role],
    );
  }

  async removeAllClientRoles(userId: string) {
    const roles = await this.listClientRoles(userId);

    if (roles.length === 0) {
      return;
    }

    const clientUuid = await this.getClientUuid();

    await this.delete(
      `${this.config.adminBaseUrl}/users/${encodeURIComponent(
        userId,
      )}/role-mappings/clients/${encodeURIComponent(clientUuid)}`,
      roles,
    );
  }

  private async getClientUuid() {
    if (this.clientUuid) {
      return this.clientUuid;
    }

    this.clientUuid = await this.getClientUuidByClientId(this.config.clientId);

    return this.clientUuid;
  }

  private async getClientUuidByClientId(clientId: string) {
    const trimmedClientId = clientId.trim();
    if (!trimmedClientId) {
      throw new KeycloakAdminError("Keycloak client id is required.");
    }

    const clients = keycloakClientsResponseSchema.parse(
      await this.get(`${this.config.adminBaseUrl}/clients`, {
        clientId: trimmedClientId,
      }),
    );
    const client = clients.find(
      (candidate) => candidate.clientId === trimmedClientId,
    );

    if (!client) {
      throw new KeycloakAdminError(
        `Keycloak client "${trimmedClientId}" could not be found.`,
      );
    }

    return client.id;
  }

  private async getClientRoleForAssignment(
    assignment: KeycloakClientRoleAssignment,
  ) {
    const clientUuid = await this.getClientUuidByClientId(assignment.clientId);
    const roleName = assignment.roleName.trim();
    if (!roleName) {
      throw new KeycloakAdminError("Keycloak client role is required.");
    }
    const role = keycloakRoleSchema.parse(
      await this.get(
        `${this.config.adminBaseUrl}/clients/${encodeURIComponent(
          clientUuid,
        )}/roles/${encodeURIComponent(roleName)}`,
      ),
    );

    return { clientUuid, role };
  }

  private async getUserRepresentation(userId: string) {
    return keycloakUserRepresentationSchema.parse(
      await this.get(
        `${this.config.adminBaseUrl}/users/${encodeURIComponent(userId)}`,
      ),
    );
  }

  private async findExactUser(
    params: { email: string } | { username: string },
  ) {
    const users = keycloakUsersResponseSchema.parse(
      await this.get(`${this.config.adminBaseUrl}/users`, {
        briefRepresentation: false,
        exact: true,
        first: 0,
        max: 2,
        ...params,
      }),
    );

    if (users.length > 1) {
      throw new KeycloakAdminError(
        "Keycloak exact user lookup returned multiple users.",
      );
    }

    return users[0] ?? null;
  }

  private async get(
    url: string,
    params?: Record<string, boolean | number | string>,
  ) {
    const response = await this.http.get(url, {
      headers: await this.getAuthorizationHeaders(),
      params,
    });

    return response.data;
  }

  private async post(url: string, data: unknown) {
    return this.http.post(url, data, {
      headers: await this.getAuthorizationHeaders(),
    });
  }

  private async put(url: string, data: unknown) {
    await this.http.put(url, data, {
      headers: await this.getAuthorizationHeaders(),
    });
  }

  private async delete(url: string, data?: unknown) {
    await this.http.delete(url, {
      data,
      headers: await this.getAuthorizationHeaders(),
    });
  }

  private async getAuthorizationHeaders() {
    return {
      Authorization: `Bearer ${await this.getAccessToken()}`,
    };
  }

  private async getAccessToken() {
    if (this.accessToken) {
      return this.accessToken;
    }

    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: "client_credentials",
    });
    const response = await this.http.post(
      `${this.config.issuer}/protocol/openid-connect/token`,
      body,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    this.accessToken = tokenResponseSchema.parse(response.data).access_token;

    return this.accessToken;
  }
}

function getHeaderValue(
  headers: Record<string, unknown> | { get?: (name: string) => unknown },
  name: string,
) {
  if ("get" in headers && typeof headers.get === "function") {
    const value = headers.get(name);
    return typeof value === "string" ? value : null;
  }

  const value =
    (headers as Record<string, unknown>)[name] ??
    (headers as Record<string, unknown>)[name.toLowerCase()] ??
    (headers as Record<string, unknown>)[
      name.replace(
        /(^|-)([a-z])/g,
        (_, prefix: string, char: string) => `${prefix}${char.toUpperCase()}`,
      )
    ];

  return typeof value === "string" ? value : null;
}
