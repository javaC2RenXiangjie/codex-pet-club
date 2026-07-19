import { getPublishedPackage, RegistryError } from "../../../../../lib/pet-registry";
import { resolvePublicPet } from "../../../../../lib/public-registry";
import { getPetRegistryBindings } from "../../../../../lib/runtime-bindings";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (request.headers.get("x-codex-pet-client") !== "skill-v1") {
    return Response.json(
      { error: "Pet packages are installed through the official Skill" },
      { status: 403 },
    );
  }

  try {
    const { id } = await context.params;
    const resolved = await resolvePublicPet(id);
    if (!resolved) {
      return Response.json({ error: "Published pet not found" }, { status: 404 });
    }

    let object: R2ObjectBody | null;
    if (resolved.source === "official") {
      const packages = getPetRegistryBindings()?.PET_FILES;
      if (!packages) {
        return Response.json({ error: "Pet package storage is unavailable" }, { status: 503 });
      }
      object = await packages.get(resolved.pet.packageKey);
    } else {
      object = (await getPublishedPackage(id)).object;
    }
    if (!object) {
      return Response.json({ error: "Published pet package is unavailable" }, { status: 404 });
    }
    const pet = resolved.pet;
    return new Response(object.body, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${pet.petKey}.zip"`,
        "cache-control": "private, no-store",
        etag: `"${pet.sha256}"`,
        "x-pet-sha256": pet.sha256,
        "x-pet-key": pet.petKey,
        "x-pet-version": pet.version,
      },
    });
  } catch (error) {
    if (error instanceof RegistryError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json({ error: "Unexpected registry error" }, { status: 500 });
  }
}
