import { getDummyUserById } from "../lib/dummy-users-store";
import {
  listWorkforceConversations,
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

const requireUserAndDataset = (request: Request) => {
  const { searchParams } = new URL(request.url);
  const userId = text(searchParams.get("userId"));
  const datasetId = text(searchParams.get("datasetId"));

  if (!userId || !datasetId) {
    throw new HttpError(400, "userId and datasetId are required.");
  }

  if (!getDummyUserById(userId)) {
    throw new HttpError(404, "Dataset not found.");
  }

  return { userId, datasetId };
};

export async function GET(request: Request, path: string[] = []) {
  try {
    const { userId, datasetId } = requireUserAndDataset(request);
    const conversationId = text(path[0]);

    if (!conversationId) {
      return json({
        status: "success",
        conversations: listWorkforceConversations({ userId, datasetId }),
      });
    }

    return json({
      status: "success",
      conversation: readWorkforceConversation({ conversationId, userId, datasetId }),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ status: "failure", error: error.message }, error.statusCode);
    }

    const message = error instanceof Error ? error.message : "Failed to load conversations.";
    return json({ status: "failure", error: message }, 400);
  }
}
