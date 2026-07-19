import { adminOnlyResponse } from "../../../../lib/admin-auth";
import {
  createRegistryBackup,
  listRegistryBackups,
} from "../../../../lib/registry-backup";
import { RegistryError } from "../../../../lib/pet-registry";

export const dynamic = "force-dynamic";

function registryError(error: unknown) {
  if (error instanceof RegistryError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Unexpected backup error" }, { status: 500 });
}

export async function GET(request: Request) {
  const blocked = await adminOnlyResponse(request);
  if (blocked) return blocked;
  try {
    return Response.json(
      { backups: await listRegistryBackups() },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return registryError(error);
  }
}

export async function POST(request: Request) {
  const blocked = await adminOnlyResponse(request);
  if (blocked) return blocked;
  try {
    return Response.json(
      { backup: await createRegistryBackup() },
      { status: 201, headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return registryError(error);
  }
}
