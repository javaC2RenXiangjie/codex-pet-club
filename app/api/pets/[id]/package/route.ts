import { findPublicPet } from "../../../../../lib/public-pet-catalog";
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

  const { id } = await context.params;
  const pet = findPublicPet(id);
  if (!pet) return Response.json({ error: "Published pet not found" }, { status: 404 });

  const packages = getPetRegistryBindings()?.PET_FILES;
  if (!packages) {
    return Response.json({ error: "Pet package storage is unavailable" }, { status: 503 });
  }
  const object = await packages.get(pet.packageKey);
  if (!object) {
    return Response.json({ error: "Published pet package is unavailable" }, { status: 404 });
  }
  return new Response(object.body, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${pet.petKey}.zip"`,
      "cache-control": "private, no-store",
      etag: `"${pet.sha256}"`,
      "x-pet-sha256": pet.sha256,
      "x-pet-key": pet.petKey,
    },
  });
}
