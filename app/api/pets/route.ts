import {
  createSubmission,
  enforceSubmissionRateLimit,
  RegistryError,
} from "../../../lib/pet-registry";
import { listPublicPetCatalog } from "../../../lib/public-registry";
import {
  apiKeyUser,
  UserAuthError,
  userAuthErrorResponse,
} from "../../../lib/user-auth";

export const dynamic = "force-dynamic";

function registryError(error: unknown) {
  if (error instanceof RegistryError) {
    return Response.json(
      { error: error.message },
      {
        status: error.status,
        headers: {
          "cache-control": "private, no-store",
          ...error.headers,
        },
      },
    );
  }
  console.error(error);
  return Response.json({ error: "Unexpected registry error" }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return Response.json(
      await listPublicPetCatalog({
        query: url.searchParams.get("query") ?? "",
        category: url.searchParams.get("category") ?? "",
        tag: url.searchParams.get("tag") ?? "",
        sort: url.searchParams.get("sort") ?? "newest",
        page: Number(url.searchParams.get("page") ?? "1"),
        pageSize: Number(url.searchParams.get("pageSize") ?? "12"),
      }),
      { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" } },
    );
  } catch (error) {
    return registryError(error);
  }
}

export async function POST(request: Request) {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data")) {
    return Response.json(
      { error: "Content-Type must be multipart/form-data" },
      { status: 415 },
    );
  }
  const declaredSize = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredSize) && declaredSize > 34 * 1024 * 1024) {
    return Response.json({ error: "Upload body is too large" }, { status: 413 });
  }

  try {
    const owner = await apiKeyUser(request);
    await enforceSubmissionRateLimit(request);
    const form = await request.formData();
    const packageFile = form.get("package");
    const metadataText = form.get("metadata");
    if (!(packageFile instanceof File)) {
      throw new RegistryError("package must be a ZIP file");
    }
    if (typeof metadataText !== "string") {
      throw new RegistryError("metadata must be a JSON string");
    }
    const parsed = JSON.parse(metadataText) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new RegistryError("metadata must be a JSON object");
    }
    const submission = await createSubmission(
      packageFile,
      parsed as Record<string, unknown>,
      owner,
    );
    return Response.json(
      { submission },
      { status: 202, headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof UserAuthError) return userAuthErrorResponse(error);
    if (error instanceof SyntaxError) {
      return Response.json({ error: "metadata must be valid JSON" }, { status: 400 });
    }
    return registryError(error);
  }
}
