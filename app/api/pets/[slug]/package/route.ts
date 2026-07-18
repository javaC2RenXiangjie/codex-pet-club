import {
  getPublishedPackage,
  RegistryError,
} from "../../../../../lib/pet-registry";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const { row, object } = await getPublishedPackage(slug);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("content-type", "application/zip");
    headers.set("content-disposition", `attachment; filename="${row.slug}.zip"`);
    headers.set("cache-control", "public, max-age=3600, immutable");
    headers.set("etag", `"${row.sha256}"`);
    headers.set("x-pet-sha256", row.sha256);
    return new Response(object.body, { headers });
  } catch (error) {
    if (error instanceof RegistryError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json({ error: "Unexpected registry error" }, { status: 500 });
  }
}
