import { findPublicPet } from "../../../../../lib/public-pet-catalog";
import { getPetRegistryBindings } from "../../../../../lib/runtime-bindings";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const pet = findPublicPet(id);
  if (!pet) return Response.json({ error: "Published pet not found" }, { status: 404 });

  const assets = getPetRegistryBindings()?.ASSETS;
  if (!assets) {
    return Response.json({ error: "Pet preview storage is unavailable" }, { status: 503 });
  }
  const asset = await assets.fetch(new Request(new URL(pet.previewPath, request.url)));
  if (!asset.ok || !asset.body) {
    return Response.json({ error: "Published pet preview is unavailable" }, { status: 404 });
  }
  return new Response(asset.body, {
    headers: {
      "content-type": "image/webp",
      "cache-control": "public, max-age=86400, immutable",
      "content-disposition": "inline",
      "x-content-type-options": "nosniff",
      etag: `"${pet.sha256}"`,
    },
  });
}
