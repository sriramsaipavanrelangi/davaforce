import { loginDummyUser } from "../lib/dummy-users-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = body.username?.trim() ?? "";
    const password = body.password?.trim() ?? "";

    if (!username || !password) {
      return json(
        {
          status: "failure",
          success: false,
          error: "username and password are required.",
        },
        400,
      );
    }

    const user = loginDummyUser(username, password);
    if (!user) {
      return json(
        {
          status: "failure",
          success: false,
          error: "Invalid username or password.",
        },
        401,
      );
    }

    return json({
      status: "success",
      success: true,
      userId: user.userId,
      username: user.username,
      role: user.role,
      profileImage: user.profileImage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed.";
    return json({ status: "failure", success: false, error: message }, 400);
  }
}
