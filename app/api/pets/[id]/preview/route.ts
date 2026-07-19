import { getPublishedSprite, RegistryError } from "../../../../../lib/pet-registry";
import { resolvePublicPet } from "../../../../../lib/public-registry";
import { getPetRegistryBindings } from "../../../../../lib/runtime-bindings";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const resolved = await resolvePublicPet(id);
    if (!resolved) {
      return Response.json({ error: "Published pet not found" }, { status: 404 });
    }

    let body: BodyInit;
    if (resolved.source === "official") {
      const assets = getPetRegistryBindings()?.ASSETS;
      if (!assets) {
        return Response.json({ error: "Pet preview storage is unavailable" }, { status: 503 });
      }
      const asset = await assets.fetch(
        new Request(new URL(resolved.pet.previewPath, request.url)),
      );
      if (!asset.ok || !asset.body) {
        return Response.json({ error: "Published pet preview is unavailable" }, { status: 404 });
      }
      body = asset.body;
    } else {
      const { sprite } = await getPublishedSprite(id);
      body = sprite.buffer.slice(
        sprite.byteOffset,
        sprite.byteOffset + sprite.byteLength,
      ) as ArrayBuffer;
    }
    return new Response(body, {
      headers: {
        "content-type": "image/webp",
        "cache-control": "public, max-age=86400, immutable",
        "content-disposition": "inline",
        "x-content-type-options": "nosniff",
        etag: `"${resolved.pet.sha256}"`,
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
