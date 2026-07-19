import { findPublicPet, toPublicPet } from "../../../../lib/public-pet-catalog";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const pet = findPublicPet(id);
  if (!pet) return Response.json({ error: "Published pet not found" }, { status: 404 });
  return Response.json(
    { pet: toPublicPet(pet) },
    { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}
