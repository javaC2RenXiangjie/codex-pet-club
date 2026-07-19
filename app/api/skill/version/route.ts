import skillRelease from "../../../../registry/skill-release.json";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(skillRelease, {
    headers: {
      "cache-control": "no-store, max-age=0",
    },
  });
}
