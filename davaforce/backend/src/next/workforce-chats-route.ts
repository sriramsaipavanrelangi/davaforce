import { getDummyUserById } from "../lib/dummy-users-store";
import {
  deleteWorkforceConversation,
  listWorkforceConversationsForUser,
  readWorkforceConversation,
} from "../lib/workforce-conversation-store";
import { text } from "../lib/workforce-data-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, { status });

class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

const requireUser = (request: Request) => {
  const { searchParams } = new URL(request.url);
  const userId = text(searchParams.get("userId"));

  if (!userId) {
    throw new HttpError(400, "userId is required.");
  }

  if (!getDummyUserById(userId)) {
    throw new HttpError(404, "User not found.");
  }

  return userId;
};

export async function GET(request: Request, path: string[] = []) {
  try {
    const userId = requireUser(request);
    const conversationId = text(path[0]);

    if (!conversationId) {
      return json({
        status: "success",
        conversations: listWorkforceConversationsForUser({ userId }),
      });
    }

    return json({
      status: "success",
      conversation: readWorkforceConversation({ conversationId, userId }),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ status: "failure", error: error.message }, error.statusCode);
    }

    const message = error instanceof Error ? error.message : "Failed to load chats.";
    return json({ status: "failure", error: message }, 400);
  }
}

export async function DELETE(request: Request, path: string[] = []) {
  try {
    const userId = requireUser(request);
    const conversationId = text(path[0]);

    if (!conversationId) {
      return json({ status: "failure", error: "conversationId is required." }, 400);
    }

    return json({
      status: "success",
      deletion: deleteWorkforceConversation({ conversationId, userId }),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ status: "failure", error: error.message }, error.statusCode);
    }

    const message = error instanceof Error ? error.message : "Failed to delete chat.";
    return json({ status: "failure", error: message }, 400);
  }
}
