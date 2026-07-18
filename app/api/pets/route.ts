import {
  createSubmission,
  listPublishedPets,
  RegistryError,
} from "../../../lib/pet-registry";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof RegistryError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Unexpected registry error" }, { status: 500 });
}

export async function GET() {
  try {
    return Response.json({ pets: await listPublishedPets() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("package");
    const metadataValue = form.get("metadata");
    if (!(file instanceof File)) {
      throw new RegistryError("package is required");
    }
    let metadata: Record<string, unknown> = {};
    if (typeof metadataValue === "string" && metadataValue.trim()) {
      try {
        const parsed = JSON.parse(metadataValue);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("not an object");
        }
        metadata = parsed;
      } catch {
        throw new RegistryError("metadata must be a JSON object");
      }
    }
    const submission = await createSubmission(file, metadata);
    return Response.json({ submission }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
