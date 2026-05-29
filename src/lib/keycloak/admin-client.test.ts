import { describe, expect, test } from "bun:test";
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from "axios";

import {
  createKeycloakAdminClient,
  getKeycloakAdminConfigFromEnv,
} from "@/lib/keycloak/admin-client";

type RecordedRequest = {
  data?: unknown;
  headers?: AxiosRequestConfig["headers"];
  method?: string;
  params?: unknown;
  url?: string;
};

function createAdapter(
  handler: (config: AxiosRequestConfig) => unknown,
): {
  adapter: AxiosAdapter;
  requests: RecordedRequest[];
} {
  const requests: RecordedRequest[] = [];

  return {
    requests,
    adapter: async (config) => {
      requests.push({
        data: config.data,
        headers: config.headers,
        method: config.method,
        params: config.params,
        url: config.url,
      });

      return {
        config,
        data: handler(config),
        headers: {},
        status: 200,
        statusText: "OK",
      } satisfies AxiosResponse;
    },
  };
}

describe("getKeycloakAdminConfigFromEnv", () => {
  test("derives realm and admin base URL from the issuer", () => {
    const config = getKeycloakAdminConfigFromEnv({
      KEYCLOAK_CLIENT_ID: "applications",
      KEYCLOAK_CLIENT_SECRET: "secret",
      KEYCLOAK_ISSUER: "https://sso.example.test/realms/mladi-pirati/",
    });

    expect(config).toEqual({
      clientId: "applications",
      clientSecret: "secret",
      issuer: "https://sso.example.test/realms/mladi-pirati",
      realm: "mladi-pirati",
      adminBaseUrl: "https://sso.example.test/admin/realms/mladi-pirati",
      defaultClientRoleName: "user",
    });
  });

  test("preserves an issuer context path when deriving the admin base URL", () => {
    const config = getKeycloakAdminConfigFromEnv({
      KEYCLOAK_CLIENT_ID: "applications",
      KEYCLOAK_CLIENT_SECRET: "secret",
      KEYCLOAK_ISSUER: "https://sso.example.test/auth/realms/mladi-pirati/",
    });

    expect(config.adminBaseUrl).toBe(
      "https://sso.example.test/auth/admin/realms/mladi-pirati",
    );
  });

  test("uses KEYCLOAK_ADMIN for admin API calls when configured", () => {
    const config = getKeycloakAdminConfigFromEnv({
      KEYCLOAK_ADMIN: "https://sso.example.test/admin/realms/mladi-pirati/",
      KEYCLOAK_CLIENT_ID: "applications",
      KEYCLOAK_CLIENT_SECRET: "secret",
      KEYCLOAK_ISSUER: "https://sso.example.test/auth/realms/mladi-pirati/",
    });

    expect(config).toMatchObject({
      adminBaseUrl: "https://sso.example.test/admin/realms/mladi-pirati",
      issuer: "https://sso.example.test/auth/realms/mladi-pirati",
      realm: "mladi-pirati",
    });
  });
});

describe("Keycloak admin client", () => {
  test("creates a Keycloak user and resolves the id from the Location header", async () => {
    const { adapter, requests } = createAdapter((config) => {
      if (config.url?.endsWith("/protocol/openid-connect/token")) {
        return { access_token: "token" };
      }

      if (
        config.method === "post" &&
        config.url?.endsWith("/admin/realms/demo/users")
      ) {
        return {};
      }

      if (
        config.method === "get" &&
        config.url?.endsWith("/admin/realms/demo/users/user-1")
      ) {
        return {
          email: "ana@example.test",
          enabled: true,
          firstName: "Ana",
          id: "user-1",
          lastName: "Novak",
          username: "ana.novak",
        };
      }

      throw new Error(`Unexpected request ${config.method} ${config.url}`);
    });
    const originalAdapter = adapter;
    const adapterWithLocation: AxiosAdapter = async (config) => {
      const response = await originalAdapter(config);
      if (
        config.method === "post" &&
        config.url?.endsWith("/admin/realms/demo/users")
      ) {
        return {
          ...response,
          headers: {
            location:
              "https://sso.example.test/admin/realms/demo/users/user-1",
          },
          status: 201,
          statusText: "Created",
        };
      }
      return response;
    };

    const client = createKeycloakAdminClient(
      {
        adminBaseUrl: "https://sso.example.test/admin/realms/demo",
        clientId: "applications",
        clientSecret: "secret",
        defaultClientRoleName: "user",
        issuer: "https://sso.example.test/realms/demo",
        realm: "demo",
      },
      { adapter: adapterWithLocation },
    );

    await expect(
      client.createUser({
        email: "ana@example.test",
        firstName: "Ana",
        lastName: "Novak",
        username: "ana.novak",
      }),
    ).resolves.toMatchObject({
      email: "ana@example.test",
      id: "user-1",
      username: "ana.novak",
    });

    const createRequest = requests.find(
      (request) =>
        request.method === "post" &&
        request.url?.endsWith("/admin/realms/demo/users"),
    );
    expect(JSON.parse(String(createRequest?.data))).toEqual({
      email: "ana@example.test",
      emailVerified: false,
      enabled: true,
      firstName: "Ana",
      lastName: "Novak",
      username: "ana.novak",
    });
  });

  test("finds exact users by email and username", async () => {
    const { adapter, requests } = createAdapter((config) => {
      if (config.url?.endsWith("/protocol/openid-connect/token")) {
        return { access_token: "token" };
      }

      if (config.url?.endsWith("/admin/realms/demo/users")) {
        if ((config.params as { email?: string }).email) {
          return [
            {
              email: "ana@example.test",
              firstName: "Ana",
              id: "user-1",
              lastName: "Novak",
              username: "ana.novak",
            },
          ];
        }

        return [];
      }

      throw new Error(`Unexpected request ${config.url}`);
    });

    const client = createKeycloakAdminClient(
      {
        adminBaseUrl: "https://sso.example.test/admin/realms/demo",
        clientId: "applications",
        clientSecret: "secret",
        defaultClientRoleName: "user",
        issuer: "https://sso.example.test/realms/demo",
        realm: "demo",
      },
      { adapter },
    );

    await expect(client.findUserByEmail("Ana@Example.Test")).resolves.toMatchObject({
      id: "user-1",
      username: "ana.novak",
    });
    await expect(client.findUserByUsername("missing")).resolves.toBeNull();

    expect(
      requests
        .filter((request) => request.url?.endsWith("/admin/realms/demo/users"))
        .map((request) => request.params),
    ).toEqual([
      {
        briefRepresentation: false,
        email: "ana@example.test",
        exact: true,
        first: 0,
        max: 2,
      },
      {
        briefRepresentation: false,
        exact: true,
        first: 0,
        max: 2,
        username: "missing",
      },
    ]);
  });

  test("sends required actions email for a Keycloak user", async () => {
    const { adapter, requests } = createAdapter((config) => {
      if (config.url?.endsWith("/protocol/openid-connect/token")) {
        return { access_token: "token" };
      }

      if (config.method === "put") {
        return {};
      }

      throw new Error(`Unexpected request ${config.method} ${config.url}`);
    });

    const client = createKeycloakAdminClient(
      {
        adminBaseUrl: "https://sso.example.test/admin/realms/demo",
        clientId: "applications",
        clientSecret: "secret",
        defaultClientRoleName: "user",
        issuer: "https://sso.example.test/realms/demo",
        realm: "demo",
      },
      { adapter },
    );

    await client.sendRequiredActionsEmail("user-1", [
      "VERIFY_EMAIL",
      "UPDATE_PASSWORD",
    ]);

    const emailRequest = requests.find((request) => request.method === "put");
    expect(emailRequest?.url).toBe(
      "https://sso.example.test/admin/realms/demo/users/user-1/execute-actions-email",
    );
    expect(JSON.parse(String(emailRequest?.data))).toEqual([
      "VERIFY_EMAIL",
      "UPDATE_PASSWORD",
    ]);
  });

  test("fetches all users across paginated responses", async () => {
    const { adapter, requests } = createAdapter((config) => {
      if (config.url?.endsWith("/protocol/openid-connect/token")) {
        return { access_token: "token" };
      }

      if (config.url?.endsWith("/admin/realms/demo/users")) {
        if ((config.params as { first: number }).first === 0) {
        return [
          { id: "1", username: "ana", firstName: "Ana", lastName: "Novak" },
        ];
        }

        return [];
      }

      throw new Error(`Unexpected request ${config.url}`);
    });

    const client = createKeycloakAdminClient(
      {
        adminBaseUrl: "https://sso.example.test/admin/realms/demo",
        clientId: "applications",
        clientSecret: "secret",
        defaultClientRoleName: "user",
        issuer: "https://sso.example.test/realms/demo",
        realm: "demo",
      },
      { adapter, pageSize: 1 },
    );

    await expect(client.listUsers()).resolves.toEqual([
      {
        email: null,
        emailVerified: false,
        enabled: true,
        firstName: "Ana",
        fullName: "Ana Novak",
        id: "1",
        lastName: "Novak",
        username: "ana",
      },
    ]);

    expect(
      requests
        .filter((request) => request.url?.endsWith("/admin/realms/demo/users"))
        .map((request) => request.params),
    ).toEqual([
      { briefRepresentation: false, first: 0, max: 1 },
      { briefRepresentation: false, first: 1, max: 1 },
    ]);
  });

  test("grants the default client role only when missing", async () => {
    const { adapter, requests } = createAdapter((config) => {
      if (config.url?.endsWith("/protocol/openid-connect/token")) {
        return { access_token: "token" };
      }

      if (config.url?.endsWith("/admin/realms/demo/clients")) {
        return [{ id: "client-uuid", clientId: "applications" }];
      }

      if (config.url?.endsWith("/role-mappings/clients/client-uuid")) {
        return [];
      }

      if (config.url?.endsWith("/admin/realms/demo/clients/client-uuid/roles/user")) {
        return { id: "role-id", name: "user" };
      }

      if (config.method === "post") {
        return {};
      }

      throw new Error(`Unexpected request ${config.method} ${config.url}`);
    });

    const client = createKeycloakAdminClient(
      {
        adminBaseUrl: "https://sso.example.test/admin/realms/demo",
        clientId: "applications",
        clientSecret: "secret",
        defaultClientRoleName: "user",
        issuer: "https://sso.example.test/realms/demo",
        realm: "demo",
      },
      { adapter },
    );

    await client.ensureDefaultClientRole("user-1");

    const grantRequest = requests.find(
      (request) =>
        request.method === "post" &&
        request.url?.includes("/role-mappings/clients/"),
    );
    expect(grantRequest?.url).toBe(
      "https://sso.example.test/admin/realms/demo/users/user-1/role-mappings/clients/client-uuid",
    );
    expect(JSON.parse(String(grantRequest?.data))).toEqual([
      { id: "role-id", name: "user" },
    ]);
  });

  test("removes all mapped client roles when revoking access", async () => {
    const mappedRoles = [
      { id: "role-id", name: "user" },
      { id: "legacy-role-id", name: "legacy" },
    ];
    const { adapter, requests } = createAdapter((config) => {
      if (config.url?.endsWith("/protocol/openid-connect/token")) {
        return { access_token: "token" };
      }

      if (config.url?.endsWith("/admin/realms/demo/clients")) {
        return [{ id: "client-uuid", clientId: "applications" }];
      }

      if (
        config.method === "get" &&
        config.url?.endsWith("/role-mappings/clients/client-uuid")
      ) {
        return mappedRoles;
      }

      if (config.method === "delete") {
        return {};
      }

      throw new Error(`Unexpected request ${config.method} ${config.url}`);
    });

    const client = createKeycloakAdminClient(
      {
        adminBaseUrl: "https://sso.example.test/admin/realms/demo",
        clientId: "applications",
        clientSecret: "secret",
        defaultClientRoleName: "user",
        issuer: "https://sso.example.test/realms/demo",
        realm: "demo",
      },
      { adapter },
    );

    await client.removeAllClientRoles("user-1");

    const revokeRequest = requests.find(
      (request) =>
        request.method === "delete" &&
        request.url?.includes("/role-mappings/clients/"),
    );
    expect(revokeRequest?.url).toBe(
      "https://sso.example.test/admin/realms/demo/users/user-1/role-mappings/clients/client-uuid",
    );
    expect(JSON.parse(String(revokeRequest?.data))).toEqual(mappedRoles);
  });

  test("searches users with full representations and deduplicates search, username, and email matches", async () => {
    const { adapter, requests } = createAdapter((config) => {
      if (config.url?.endsWith("/protocol/openid-connect/token")) {
        return { access_token: "token" };
      }

      if (config.url?.endsWith("/admin/realms/demo/users")) {
        if ((config.params as { search?: string }).search) {
          return [
            {
              email: "ana@example.test",
              firstName: "Ana",
              id: "1",
              lastName: "Novak",
              username: "ana",
            },
          ];
        }

        if ((config.params as { email?: string }).email) {
          return [
            {
              email: "ana@example.test",
              firstName: "Ana",
              id: "1",
              lastName: "Novak",
              username: "ana",
            },
          ];
        }

        return [
          {
            email: "bor@example.test",
            firstName: "Bor",
            id: "2",
            lastName: "Horvat",
            username: "bor",
          },
        ];
      }

      throw new Error(`Unexpected request ${config.url}`);
    });

    const client = createKeycloakAdminClient(
      {
        adminBaseUrl: "https://sso.example.test/admin/realms/demo",
        clientId: "applications",
        clientSecret: "secret",
        defaultClientRoleName: "user",
        issuer: "https://sso.example.test/realms/demo",
        realm: "demo",
      },
      { adapter },
    );

    await expect(client.searchUsers(" ana@example.test ", 7)).resolves.toEqual([
      {
        email: "ana@example.test",
        emailVerified: false,
        enabled: true,
        firstName: "Ana",
        fullName: "Ana Novak",
        id: "1",
        lastName: "Novak",
        username: "ana",
      },
      {
        email: "bor@example.test",
        emailVerified: false,
        enabled: true,
        firstName: "Bor",
        fullName: "Bor Horvat",
        id: "2",
        lastName: "Horvat",
        username: "bor",
      },
    ]);

    expect(
      requests
        .filter((request) => request.url?.endsWith("/admin/realms/demo/users"))
        .map((request) => request.params),
    ).toEqual([
      {
        briefRepresentation: false,
        first: 0,
        max: 7,
        search: "ana@example.test",
      },
      {
        briefRepresentation: false,
        exact: true,
        first: 0,
        max: 7,
        username: "ana@example.test",
      },
      {
        briefRepresentation: false,
        email: "ana@example.test",
        exact: true,
        first: 0,
        max: 7,
      },
    ]);
  });

  test("updates a Keycloak user's editable profile fields without dropping existing representation fields", async () => {
    const { adapter, requests } = createAdapter((config) => {
      if (config.url?.endsWith("/protocol/openid-connect/token")) {
        return { access_token: "token" };
      }

      if (
        config.method === "get" &&
        config.url?.endsWith("/admin/realms/demo/users/user-1")
      ) {
        return {
          attributes: { locale: ["sl"] },
          email: "old@example.test",
          emailVerified: true,
          enabled: true,
          firstName: "Old",
          id: "user-1",
          lastName: "Name",
          username: "old",
        };
      }

      if (config.method === "put") {
        return {};
      }

      throw new Error(`Unexpected request ${config.method} ${config.url}`);
    });

    const client = createKeycloakAdminClient(
      {
        adminBaseUrl: "https://sso.example.test/admin/realms/demo",
        clientId: "applications",
        clientSecret: "secret",
        defaultClientRoleName: "user",
        issuer: "https://sso.example.test/realms/demo",
        realm: "demo",
      },
      { adapter },
    );

    await client.updateUserProfile("user-1", {
      email: "ana@example.test",
      firstName: "Ana",
      lastName: "Novak",
      username: "ana",
    });

    const updateRequest = requests.find(
      (request) => request.method === "put",
    );
    expect(updateRequest?.url).toBe(
      "https://sso.example.test/admin/realms/demo/users/user-1",
    );
    expect(JSON.parse(String(updateRequest?.data))).toEqual({
      attributes: { locale: ["sl"] },
      email: "ana@example.test",
      emailVerified: false,
      enabled: true,
      firstName: "Ana",
      id: "user-1",
      lastName: "Novak",
      username: "ana",
    });
  });

  test("keeps Keycloak email verification when the email value is unchanged", async () => {
    const { adapter, requests } = createAdapter((config) => {
      if (config.url?.endsWith("/protocol/openid-connect/token")) {
        return { access_token: "token" };
      }

      if (
        config.method === "get" &&
        config.url?.endsWith("/admin/realms/demo/users/user-1")
      ) {
        return {
          email: "ana@example.test",
          emailVerified: true,
          enabled: true,
          firstName: "Old",
          id: "user-1",
          lastName: "Name",
          username: "old",
        };
      }

      if (config.method === "put") {
        return {};
      }

      throw new Error(`Unexpected request ${config.method} ${config.url}`);
    });

    const client = createKeycloakAdminClient(
      {
        adminBaseUrl: "https://sso.example.test/admin/realms/demo",
        clientId: "applications",
        clientSecret: "secret",
        defaultClientRoleName: "user",
        issuer: "https://sso.example.test/realms/demo",
        realm: "demo",
      },
      { adapter },
    );

    await client.updateUserProfile("user-1", {
      email: "ana@example.test",
      firstName: "Ana",
      lastName: "Novak",
      username: "ana",
    });

    const updateRequest = requests.find(
      (request) => request.method === "put",
    );
    expect(JSON.parse(String(updateRequest?.data)).emailVerified).toBe(true);
  });
});
