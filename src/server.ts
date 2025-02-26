import { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand, RetrieveAndGenerateCommandOutput } from "@aws-sdk/client-bedrock-agent-runtime";
import express, { Request, Response } from "express";
import cors from "cors";
import awsServerlessExpress from "aws-serverless-express";
import { APIGatewayProxyEventV2, APIGatewayProxyEvent, Context } from "aws-lambda";

// Initialize Express
export const app = express();
const allowedOrigins = ["http://localhost:5173", "http://localhost:5174", "https://main.d89gasp6d5hqb.amplifyapp.com/"];
app.use(express.json());
app.use(cors());

// ✅ Handle Preflight Requests for API Gateway
app.options("/bedrockAgentAPI", (req, res) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.set({
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "OPTIONS, POST",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    });
    console.log("✅ CORS Preflight Request Handled");
  }
  res.status(200).send(); // ✅ Ensure HTTP 200 OK (not 204)
});

// ✅ Enable CORS for Allowed Origins
app.use((req, res, next) => {
  const origin = req.headers.origin as string;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "OPTIONS, POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  next();
});

// ✅ Log Incoming Requests
app.use((req, res, next) => {
  console.log(`📩 Received Request: ${req.method} ${req.path}`);
  next();
});

// ✅ Define API Route (Matches API Gateway Route)
app.post("/bedrockAgentAPI", async (req: Request<{},{},{ userInput: string }, {}>, res: Response) => {
  try {
    const { userInput } = req.body;

    if (!userInput) {
      res.status(400).json({ error: "Missing user input" });
      return;
    }

    console.log(`📡 Sending request to Bedrock Agent: ${userInput}`);

    const command = new RetrieveAndGenerateCommand({
      input: { text: userInput },
      retrieveAndGenerateConfiguration: {
        type: "KNOWLEDGE_BASE",
        knowledgeBaseConfiguration: {
          knowledgeBaseId: process.env.BEDROCK_KNOWLEDGE_BASE_ID as string,
          modelArn: process.env.BEDROCK_MODEL_URL as string,
        },
      },
    });

    const response: RetrieveAndGenerateCommandOutput = await new BedrockAgentRuntimeClient({
      region: process.env.AWS_REGION || "us-east-2",
    }).send(command);

    console.log("📢 Agent Response:", response.output?.text || "No response from agent");

    res.json({
      sessionId: response.sessionId ?? "N/A",
      agentResponse: response.output?.text || "No response from agent",
    });

  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ error: "Agent invocation failed" });
  }
});

// ✅ Default Route Handler (Handles All Other Invalid Requests)
app.use((req, res) => {
  console.log("❌ Invalid route accessed:", req.method, req.path);
  res.status(404).json({ error: "Invalid route." });
});

// ✅ Create AWS Lambda Handler
const server = awsServerlessExpress.createServer(app);
export const handler = (event: APIGatewayProxyEventV2, context: Context) => {
  console.log("🔹 API Gateway Event:", JSON.stringify(event, null, 2));

  // ✅ Normalize API Gateway Path (API Gateway v2 uses `rawPath`)
  const normalizedPath = event.rawPath || event.requestContext.http.path;
  console.log(`✅ Normalized Path: ${normalizedPath}`);

  // ✅ Convert APIGatewayProxyEventV2 to APIGatewayProxyEvent-compatible format
  const convertedEvent: APIGatewayProxyEvent = {
    path: normalizedPath,
    httpMethod: event.requestContext.http.method,
    resource: normalizedPath, // Needed for Express routing
    headers: event.headers || {},
    multiValueHeaders: {}, // Ensure it's defined for compatibility
    queryStringParameters: event.queryStringParameters || {},
    multiValueQueryStringParameters: {}, // Needed for compatibility
    body: event.body ?? null, // ✅ Ensure it's string | null (Fixes TS error)
    isBase64Encoded: event.isBase64Encoded ?? false,
    requestContext: event.requestContext as any, // Cast as `any` to avoid type errors
    pathParameters: event.pathParameters || {},
    stageVariables: event.stageVariables || {},
  };

  // ✅ Proxy the converted event to Express
  awsServerlessExpress.proxy(server, convertedEvent, context);
};