import { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand, RetrieveAndGenerateCommandOutput } from "@aws-sdk/client-bedrock-agent-runtime";
import express, { Request, Response } from "express";
import cors from "cors";
import awsServerlessExpress from "aws-serverless-express";
import { APIGatewayProxyEvent, Context } from "aws-lambda";

// Initialize Express
export const app = express();
app.use(express.json());
app.use(cors());

// ✅ Initialize AWS Bedrock Client WITHOUT credentials (Lambda uses IAM Role)
const bedrockClient = new BedrockAgentRuntimeClient({
  region: process.env.AWS_REGION || "us-east-2", // Ensure this matches your AWS region
});

// Knowledge Base & Model ARNs
const knowledgeBaseId = process.env.BEDROCK_KNOWLEDGE_BASE_ID as string;
const inferenceProfileArn = process.env.BEDROCK_MODEL_URL; // Use the working inference profile

// Define request body interface
interface AskAgentRequestBody {
  userInput: string;
}

// API Route for /ask-agent
app.post("/ask-agent", async (req: Request<{}, {}, AskAgentRequestBody>, res: Response): Promise<void> => {
  try {
    const { userInput } = req.body;

    if (!userInput) {
      res.status(400).json({ error: "Missing user input" });
      return;
    }

    console.log("📡 Sending request to Bedrock Agent...");
    console.log(`🔹 Knowledge Base ID: ${knowledgeBaseId}`);
    console.log(`🔹 Inference Profile ARN: ${inferenceProfileArn}`);
    console.log(`🔹 User Input: ${userInput}`);

    const command = new RetrieveAndGenerateCommand({
      input: {
        text: userInput,
      },
      retrieveAndGenerateConfiguration: {
        type: "KNOWLEDGE_BASE",
        knowledgeBaseConfiguration: {
          knowledgeBaseId,
          modelArn: inferenceProfileArn as string,
        },
      },
    });

    const response: RetrieveAndGenerateCommandOutput = await bedrockClient.send(command);

    console.log("📩 Raw Response from Bedrock Agent:", response);

    const generatedResponse = response.output?.text || "No response from agent";

    console.log("📢 Agent Response:", generatedResponse);

    res.json({
      sessionId: response.sessionId ?? "N/A",
      agentResponse: generatedResponse,
    });
  } catch (error) {
    console.error("❌ Error invoking Bedrock Agent:", error);
    res.status(500).json({ error: "Agent invocation failed" });
  }
});

// ✅ Create AWS Lambda Handler
const server = awsServerlessExpress.createServer(app);

export const handler = (event: APIGatewayProxyEvent, context: Context) => {
  awsServerlessExpress.proxy(server, event, context);
};