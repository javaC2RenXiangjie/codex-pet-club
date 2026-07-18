import { getStore } from "@edgeone/pages-blob";
import { findPublicPet } from "../../../../../lib/public-pet-catalog";

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

  const packages = getStore("pet-packages");
  const body = await packages.get(pet.packageKey, {
    type: "stream",
    consistency: "strong",
  });
  if (!body) {
    return Response.json({ error: "Published pet package is unavailable" }, { status: 404 });
  }
  return new Response(body, {
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
