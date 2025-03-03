import { BedrockAgentRuntimeClient, InvokeAgentCommand } from "@aws-sdk/client-bedrock-agent-runtime";
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
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-session-id",
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-session-id");
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

    // Log environment variables (excluding sensitive values)
    console.log('Environment Check:', {
      hasAgentId: !!process.env.BEDROCK_AGENT_ID,
      hasAliasId: !!process.env.BEDROCK_AGENT_ALIAS_ID,
      region: process.env.BEDROCK_AWS_REGION
    });

    console.log(`📡 Sending request to Bedrock Agent: ${userInput}`);

    // Get sessionId from headers
    const sessionId = req.headers['x-session-id'] as string;
    if (!sessionId) {
      res.status(400).json({ error: "Missing x-session-id header" });
      return;
    }
    console.log('Using Session ID:', sessionId);

    const commandParams = {
      agentId: process.env.BEDROCK_AGENT_ID as string,
      agentAliasId: process.env.BEDROCK_AGENT_ALIAS_ID,
      sessionId: sessionId,
      inputText: userInput,
      enableTrace: true,
      streamingConfigurations: {
        streamResponseHandler: "NONE",
        applyGuardrailInterval: 1
      }
    };

    const command = new InvokeAgentCommand(commandParams);

    const client = new BedrockAgentRuntimeClient({
      region: process.env.BEDROCK_AWS_REGION || "us-east-2"
    });

    const response = await client.send(command);

    // Handle streaming response
    let agentResponse = '';
    if (response.completion) {
      try {
        // Handle Smithy message stream
        for await (const chunk of response.completion) {
          if (chunk.chunk?.bytes) {
            const decodedChunk = new TextDecoder().decode(chunk.chunk.bytes);
            agentResponse += decodedChunk;
          }
        }
      } catch (streamError) {
        console.error('Error processing stream:', streamError);
        agentResponse = "Error: Failed to process agent response stream";
      }
    } else {
      console.error('Unexpected response format:', response);
      agentResponse = "Error: No response from agent";
    }

    console.log("📢 Agent Response:", agentResponse);
    console.log("📢 Session ID from response:", response.sessionId);

    res.json({
      sessionId: response.sessionId,
      agentResponse: agentResponse || "No response content"
    });

  } catch (error: any) {
    console.error("❌ Detailed Error:", {
      message: error.message,
      code: error.code,
      requestId: error.$metadata?.requestId,
      stack: error.stack
    });
    
    // Return more specific error messages based on the error type
    if (error.code === 'ValidationException') {
      res.status(400).json({ error: "Invalid request parameters", details: error.message });
    } else if (error.code === 'ResourceNotFoundException') {
      res.status(404).json({ error: "Bedrock Agent not found", details: error.message });
    } else if (error.code === 'AccessDeniedException') {
      res.status(403).json({ error: "Access denied to Bedrock Agent", details: error.message });
    } else {
      res.status(500).json({ 
        error: "Agent invocation failed",
        details: error.message,
        requestId: error.$metadata?.requestId 
      });
    }
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