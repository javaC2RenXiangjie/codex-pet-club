import {
  getPublishedPackage,
  RegistryError,
} from "../../../../../lib/pet-registry";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (request.headers.get("x-codex-pet-client") !== "skill-v1") {
      return Response.json(
        { error: "Pet packages are installed through the official Skill" },
        { status: 403 },
      );
    }
    const { id } = await context.params;
    const { row, object } = await getPublishedPackage(id);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("content-type", "application/zip");
    headers.set("content-disposition", `attachment; filename="${row.slug}.zip"`);
    headers.set("cache-control", "private, no-store");
    headers.set("etag", `"${row.sha256}"`);
    headers.set("x-pet-sha256", row.sha256);
    headers.set("x-pet-key", row.slug);
    return new Response(object.body, { headers });
  } catch (error) {
    if (error instanceof RegistryError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json({ error: "Unexpected registry error" }, { status: 500 });
  }
}
