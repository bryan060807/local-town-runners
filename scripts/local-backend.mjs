// Reduced integration stack: PostgreSQL, Supabase GoTrue, PostgREST. Local test credentials only.
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { randomBytes, createHmac } from "node:crypto";
import path from "node:path";
const dir = path.resolve(".local-backend");
await mkdir(dir, { recursive: true, mode: 0o700 });
async function run(args, input) {
  return await new Promise((resolve, reject) => {
    const p = spawn(args[0], args.slice(1), {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    p.stdout.on("data", (b) => (out += b));
    p.stderr.on("data", () => {});
    p.on("error", () => reject(Error(`Could not run ${args[0]}`)));
    p.on("close", (code) =>
      code === 0
        ? resolve(out)
        : reject(
            Error(
              `${args[0]} operation failed (exit ${code}); inspect the named local container for diagnostics without printing credentials`,
            ),
          ),
    );
    p.stdin.end(input);
  });
}
let config;
try {
  config = JSON.parse(await readFile(path.join(dir, "config.json"), "utf8"));
} catch {
  config = {
    jwt: randomBytes(48).toString("hex"),
    db: randomBytes(24).toString("hex"),
    password: randomBytes(24).toString("hex"),
  };
  await writeFile(path.join(dir, "config.json"), JSON.stringify(config), {
    mode: 0o600,
  });
}
const token = (role) => {
  const a = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    b = Buffer.from(
      JSON.stringify({
        role,
        iss: "local-town-runners-development",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 31536000,
      }),
    ).toString("base64url");
  return `${a}.${b}.${createHmac("sha256", config.jwt).update(`${a}.${b}`).digest("base64url")}`;
};
const db = "ltr-local-db",
  auth = "ltr-local-auth",
  rest = "ltr-local-rest",
  network = "ltr-local-network";
try {
  await run(["docker", "network", "inspect", network]);
} catch {
  await run(["docker", "network", "create", network]);
}
async function container(name, image, env, ports = []) {
  const envFile = path.join(dir, `${name}.env`);
  await writeFile(
    envFile,
    Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
  try {
    await run(["docker", "container", "inspect", name]);
    await run(["docker", "start", name]);
  } catch {
    await run([
      "docker",
      "run",
      "-d",
      "--name",
      name,
      "--network",
      network,
      "--env-file",
      envFile,
      ...ports.flatMap((p) => ["-p", p]),
      image,
    ]);
  }
}
await container(db, "postgres:17-alpine", { POSTGRES_PASSWORD: config.db }, [
  "127.0.0.1:54322:5432",
]);
async function ready(operation, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await operation();
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw Error("Local service readiness timed out");
}
await ready(() => run(["docker", "exec", db, "pg_isready", "-U", "postgres"]));
const initialized = await run([
  "docker",
  "exec",
  db,
  "psql",
  "-U",
  "postgres",
  "-tAc",
  "select exists(select 1 from pg_roles where rolname='supabase_auth_admin')",
]);
if (!initialized.includes("t"))
  await run(
    [
      "docker",
      "exec",
      "-i",
      db,
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    `create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create role authenticator login password '${config.db}';grant anon,authenticated,service_role to authenticator;create role supabase_auth_admin login password '${config.db}';create schema auth authorization supabase_auth_admin;create schema extensions;create extension pgcrypto with schema extensions;grant usage on schema public,extensions,auth to anon,authenticated,service_role;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;alter function auth.uid() owner to supabase_auth_admin;alter default privileges in schema public grant all on tables to service_role;alter default privileges in schema public grant all on sequences to service_role;alter default privileges in schema public grant all on functions to service_role;`,
  );
await container(
  auth,
  "supabase/gotrue:v2.186.0",
  {
    GOTRUE_API_HOST: "0.0.0.0",
    GOTRUE_API_PORT: 9999,
    API_EXTERNAL_URL: "http://127.0.0.1:54321",
    GOTRUE_SITE_URL: "http://127.0.0.1:3000",
    GOTRUE_DB_DRIVER: "postgres",
    GOTRUE_DB_DATABASE_URL: `postgres://supabase_auth_admin:${config.db}@${db}:5432/postgres?search_path=auth`,
    GOTRUE_JWT_SECRET: config.jwt,
    GOTRUE_JWT_AUD: "authenticated",
    GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated",
    GOTRUE_JWT_ADMIN_ROLES: "service_role",
    GOTRUE_DISABLE_SIGNUP: false,
    GOTRUE_MAILER_AUTOCONFIRM: true,
    GOTRUE_PASSWORD_MIN_LENGTH: 12,
  },
  ["127.0.0.1:54325:9999"],
);
await ready(async () => {
  const r = await fetch("http://127.0.0.1:54325/health");
  if (!r.ok) throw Error("Auth not ready");
});
await run(
  [
    "docker",
    "exec",
    "-i",
    db,
    "psql",
    "-U",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
  ],
  `create schema if not exists local_setup;create table if not exists local_setup.migrations(name text primary key);`,
);
for (const file of (await readdir("supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  const applied = await run([
    "docker",
    "exec",
    db,
    "psql",
    "-U",
    "postgres",
    "-tAc",
    `select exists(select 1 from local_setup.migrations where name='${file}')`,
  ]);
  if (!applied.includes("t")) {
    await run(
      [
        "docker",
        "exec",
        "-i",
        db,
        "psql",
        "-U",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      await readFile(`supabase/migrations/${file}`, "utf8"),
    );
    await run([
      "docker",
      "exec",
      db,
      "psql",
      "-U",
      "postgres",
      "-c",
      `insert into local_setup.migrations values('${file}')`,
    ]);
  }
}
await run(
  [
    "docker",
    "exec",
    "-i",
    db,
    "psql",
    "-U",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
  ],
  `create or replace function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),'')::uuid,(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid)$$;`,
);
await container(
  rest,
  "postgrest/postgrest:v14.3",
  {
    PGRST_DB_URI: `postgres://authenticator:${config.db}@${db}:5432/postgres`,
    PGRST_DB_SCHEMAS: "public",
    PGRST_DB_ANON_ROLE: "anon",
    PGRST_JWT_SECRET: config.jwt,
    PGRST_SERVER_PORT: 3000,
  },
  ["127.0.0.1:54326:3000"],
);
await ready(async () => {
  const r = await fetch("http://127.0.0.1:54326/");
  if (!r.ok) throw Error("REST not ready");
});
await writeFile(
  path.join(dir, "app.env"),
  `APP_URL=http://127.0.0.1:3000\nNEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${token("anon")}\nSUPABASE_SERVICE_ROLE_KEY=${token("service_role")}\nDEMO_SEED_PASSWORD=${config.password}\n`,
  { mode: 0o600 },
);
await run([
  "docker",
  "exec",
  db,
  "psql",
  "-U",
  "postgres",
  "-c",
  "notify pgrst, 'reload schema'",
]);
console.log(
  "Local PostgreSQL, Supabase Auth and PostgREST are healthy. Migrations applied once. Local-only credentials are stored in ignored .local-backend/app.env and were not printed. Start the gateway and seed using the documented npm scripts.",
);
