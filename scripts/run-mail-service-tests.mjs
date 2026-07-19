import { spawnSync } from "node:child_process";

const python = process.platform === "win32" ? "python" : "python3";
const result = spawnSync(
  python,
  ["-m", "unittest", "discover", "-s", "services/codex-pet-mail-service/tests", "-v"],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(`Could not start ${python}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
