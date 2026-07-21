import { listHomepagePets } from "../../../../lib/public-registry";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(
      await listHomepagePets(5),
      { headers: { "cache-control": "public, max-age=300, stale-while-revalidate=300" } },
    );
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Homepage pets are temporarily unavailable" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
