import { describe, expect, test } from "bun:test";

import { readFile } from "node:fs/promises";

describe("access-control seeding", () => {
  test("fails the command when the database cannot be seeded", async () => {
    const proc = Bun.spawn(["bun", "scripts/seed-access-control.ts"], {
      env: {
        ...process.env,
        DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:1/helm",
      },
      stderr: "pipe",
      stdout: "pipe",
    });

    await proc.exited;

    expect(proc.exitCode).not.toBe(0);
  });

  test("production deploy command runs seeding after migrations", async () => {
    const [packageJson, compose] = await Promise.all([
      readFile("package.json", "utf8"),
      readFile("docker-compose.prod.yml", "utf8"),
    ]);

    const scripts = JSON.parse(packageJson).scripts;

    expect(scripts["db:seed"]).toBe("bun scripts/seed-access-control.ts");
    expect(scripts["db:deploy"]).toContain("bun run db:migrate");
    expect(scripts["db:deploy"]).toContain("bun run db:seed");
    expect(compose).toContain('command: ["bun", "run", "db:deploy"]');
  });
});
