import {
  getModerationSprite,
  RegistryError,
} from "../../../../../../lib/pet-registry";
import { localOnlyResponse } from "../../../../../../lib/local-only";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const blocked = localOnlyResponse(request);
  if (blocked) return blocked;
  try {
    const { id } = await context.params;
    const { row, sprite } = await getModerationSprite(id);
    const body = sprite.buffer.slice(
      sprite.byteOffset,
      sprite.byteOffset + sprite.byteLength,
    ) as ArrayBuffer;
    return new Response(body, {
      headers: {
        "content-type": "image/webp",
        "cache-control": "private, no-store",
        etag: `"${row.sha256}"`,
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
