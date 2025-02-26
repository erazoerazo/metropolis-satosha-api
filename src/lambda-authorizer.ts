import { APIGatewayRequestAuthorizerEvent, APIGatewayAuthorizerResult, Context } from "aws-lambda";
import { PrivyClient, AuthTokenClaims } from "@privy-io/server-auth";
import dotenv from "dotenv";

dotenv.config();

// ✅ Initialize Privy Client
const privy = new PrivyClient(
  process.env.PRIVY_APP_ID as string,
  process.env.PRIVY_APP_SECRET as string
);

export const handler = async (
  event: APIGatewayRequestAuthorizerEvent,
  context: Context
): Promise<APIGatewayAuthorizerResult> => {
  console.log("📩 Received event:", JSON.stringify(event, null, 2));

  // ✅ Allow all OPTIONS requests (CORS preflight)
  if (event.httpMethod === "OPTIONS") {
    console.log("✅ Allowing CORS preflight request (OPTIONS) without authentication");
    return {
      principalId: "public",
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Action: "execute-api:Invoke",
            Effect: "Allow",
            Resource: "*", // Allow for all endpoints
          },
        ],
      },
    };
  }

  try {
    // ✅ Check if Authorization Header Exists
    const token = event.headers?.Authorization || event.headers?.authorization;
    if (!token) {
      throw new Error("Missing Authorization Token");
    }

    // ✅ Remove "Bearer " prefix
    const cleanToken = token.replace("Bearer ", "").trim();

    // ✅ Verify JWT using Privy
    const user: AuthTokenClaims = await privy.verifyAuthToken(cleanToken);
    console.log("✅ JWT successfully verified:", JSON.stringify(user, null, 2));

    // ✅ Extract userId (No email needed)
    const userId = user?.userId || "unknown_user";

    return {
      principalId: userId,
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Action: "execute-api:Invoke",
            Effect: "Allow",
            Resource: event.methodArn ?? "*",
          },
        ],
      },
      context: {
        userId,
      },
    };
  } catch (error) {
    console.error("❌ JWT verification failed:", error);

    return {
      principalId: "unauthorized",
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Action: "execute-api:Invoke",
            Effect: "Deny",
            Resource: event.methodArn ?? "*",
          },
        ],
      },
    };
  }
};