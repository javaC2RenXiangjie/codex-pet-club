import {
  getPublishedSprite,
  RegistryError,
} from "../../../../../lib/pet-registry";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { row, sprite } = await getPublishedSprite(id);
    return new Response(sprite, {
      headers: {
        "content-type": "image/webp",
        "cache-control": "private, no-store",
        "content-disposition": "inline",
        "x-content-type-options": "nosniff",
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
