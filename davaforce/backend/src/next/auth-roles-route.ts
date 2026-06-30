import {
  getDummyUserById,
  isDummyUserRole,
  listDummyUserRoles,
  updateDummyUserRole,
} from "../lib/dummy-users-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId")?.trim() ?? "";
    const roles = listDummyUserRoles();

    if (!userId) {
      return json({
        status: "success",
        roles,
      });
    }

    const user = getDummyUserById(userId);
    if (!user) {
      return json(
        {
          status: "failure",
          error: `User not found: ${userId}`,
        },
        404,
      );
    }

    return json({
      status: "success",
      roles,
      user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load roles.";
    return json({ status: "failure", error: message }, 400);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { userId?: string; role?: string };
    const userId = body.userId?.trim() ?? "";
    const role = body.role?.trim() ?? "";

    if (!userId || !role) {
      return json(
        {
          status: "failure",
          error: "userId and role are required.",
        },
        400,
      );
    }

    if (!isDummyUserRole(role)) {
      return json(
        {
          status: "failure",
          error: `Invalid role: ${role}`,
        },
        400,
      );
    }

    const existingUser = getDummyUserById(userId);
    if (!existingUser) {
      return json(
        {
          status: "failure",
          error: `User not found: ${userId}`,
        },
        404,
      );
    }

    const user = updateDummyUserRole({ userId, role });
    return json({
      status: "success",
      user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update role.";
    return json({ status: "failure", error: message }, 400);
  }
}
