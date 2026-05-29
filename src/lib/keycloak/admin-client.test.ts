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
});

describe("Keycloak admin client", () => {
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
        enabled: true,
        firstName: "Ana",
        fullName: "Ana Novak",
        id: "1",
        lastName: "Novak",
        username: "ana",
      },
      {
        email: "bor@example.test",
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
        first: 0,
        max: 7,
        username: "ana@example.test",
      },
      {
        briefRepresentation: false,
        email: "ana@example.test",
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
