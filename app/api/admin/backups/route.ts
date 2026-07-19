import { adminOnlyResponse } from "../../../../lib/admin-auth";
import {
  createRegistryBackup,
  listRegistryBackups,
  verifyRegistryBackup,
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

export async function PATCH(request: Request) {
  const blocked = await adminOnlyResponse(request);
  if (blocked) return blocked;
  try {
    const body = (await request.json()) as { key?: unknown };
    const key = typeof body.key === "string" ? body.key : undefined;
    return Response.json(
      { verification: await verifyRegistryBackup(key) },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "请求内容必须是 JSON" }, { status: 400 });
    }
    return registryError(error);
  }
}
