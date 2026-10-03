import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const destination = resolve(process.cwd(), "app/lib/generated-auth-secret.ts");
const secret = randomBytes(48).toString("base64url");

writeFileSync(
  destination,
  `// Generated during build. Never commit this file.\nexport const GENERATED_AUTH_SECRET = "${secret}" as const;\n`,
  { encoding: "utf8", mode: 0o600 },
);
