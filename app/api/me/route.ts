import {
  currentUser,
  maskEmail,
  userAuthErrorResponse,
} from "../../../lib/user-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    return Response.json(
      {
        user: {
          id: user.id,
          displayName: user.displayName,
          emailMasked: maskEmail(user.email),
          emailVerified: true,
        },
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return userAuthErrorResponse(error);
  }
}
