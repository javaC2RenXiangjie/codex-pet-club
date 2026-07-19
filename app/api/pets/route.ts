import { publicPets } from "../../../lib/public-pet-catalog";

export async function GET() {
  return Response.json(
    { pets: publicPets },
    { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}

export async function POST() {
  return Response.json(
    { error: "Community submissions are not open in the first public release" },
    { status: 403, headers: { "cache-control": "private, no-store" } },
  );
}
