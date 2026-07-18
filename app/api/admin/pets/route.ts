import {
  listModerationSubmissions,
  RegistryError,
} from "../../../../lib/pet-registry";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const submissions = await listModerationSubmissions();
    return Response.json(
      { submissions },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof RegistryError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json({ error: "Unexpected registry error" }, { status: 500 });
  }
}
