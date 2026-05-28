import axios, { type AxiosAdapter, type AxiosInstance } from "axios";
import { z } from "zod";

import { getKeycloakUserDisplayName } from "@/lib/auth/keycloak-access";

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_CLIENT_ROLE_NAME = "user";

const keycloakAdminEnvSchema = z.object({
  KEYCLOAK_CLIENT_ID: z.string().trim().min(1),
  KEYCLOAK_CLIENT_SECRET: z.string().trim().min(1),
  KEYCLOAK_ISSUER: z.string().trim().url(),
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
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
  })
  .transform((user) => ({
    email: user.email ?? null,
    enabled: user.enabled ?? true,
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
export type KeycloakClientRole = z.infer<typeof keycloakRoleSchema>;

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

  if (realmMarkerIndex === -1) {
    throw new KeycloakAdminError(
      "KEYCLOAK_ISSUER must include the realm path, for example https://host/realms/realm.",
    );
  }

  const realm = decodeURIComponent(
    issuerUrl.pathname.slice(realmMarkerIndex + realmMarker.length),
  );

  if (!realm) {
    throw new KeycloakAdminError("KEYCLOAK_ISSUER must include a realm name.");
  }

  return {
    adminBaseUrl: `${issuerUrl.origin}/admin/realms/${encodeRealmPathPart(realm)}`,
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
    const users: KeycloakUser[] = [];
    let first = 0;

    while (true) {
      const response = await this.get(`${this.config.adminBaseUrl}/users`, {
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

  async getUser(userId: string) {
    return keycloakUserSchema.parse(
      await this.get(
        `${this.config.adminBaseUrl}/users/${encodeURIComponent(userId)}`,
      ),
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

    const clients = keycloakClientsResponseSchema.parse(
      await this.get(`${this.config.adminBaseUrl}/clients`, {
        clientId: this.config.clientId,
      }),
    );
    const client = clients.find(
      (candidate) => candidate.clientId === this.config.clientId,
    );

    if (!client) {
      throw new KeycloakAdminError(
        `Keycloak client "${this.config.clientId}" could not be found.`,
      );
    }

    this.clientUuid = client.id;

    return client.id;
  }

  private async get(url: string, params?: Record<string, string | number>) {
    const response = await this.http.get(url, {
      headers: await this.getAuthorizationHeaders(),
      params,
    });

    return response.data;
  }

  private async post(url: string, data: unknown) {
    await this.http.post(url, data, {
      headers: await this.getAuthorizationHeaders(),
    });
  }

  private async delete(url: string, data: unknown) {
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
