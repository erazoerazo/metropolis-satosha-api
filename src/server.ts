import { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand, RetrieveAndGenerateCommandOutput } from "@aws-sdk/client-bedrock-agent-runtime";
import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();
app.use(express.json());
app.use(cors());

// Initialize AWS Bedrock Client using access keys
const bedrockClient = new BedrockAgentRuntimeClient({
  region: process.env.AWS_REGION || "us-east-2", // Ensure this matches your AWS region
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
});

// Knowledge Base & Model ARNs
const knowledgeBaseId = process.env.BEDROCK_KNOWLEDGE_BASE_ID as string;
const inferenceProfileArn = process.env.BEDROCK_MODEL_URL; // Use the working inference profile

// Define request body interface
interface AskAgentRequestBody {
  userInput: string;
}

// ✅ Improved Debugging & Logging
app.post(
  "/ask-agent",
  async (req: Request<{}, {}, AskAgentRequestBody>, res: Response): Promise<void> => {
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
            knowledgeBaseId: knowledgeBaseId,
            modelArn: inferenceProfileArn, // ✅ Using the working ARN
          },
        },
      });

      const response: RetrieveAndGenerateCommandOutput = await bedrockClient.send(command);

      console.log("📩 Raw Response from Bedrock Agent:", response);

      // ✅ Ensure proper response structure
      const generatedResponse = response.output?.text || "No response from agent";

      console.log("📢 Agent Response:", generatedResponse);

      // ✅ Return the response
      res.json({
        sessionId: response.sessionId ?? "N/A",
        agentResponse: generatedResponse,
      });
    } catch (error) {
      console.error("❌ Error invoking Bedrock Agent:", error);
      res.status(500).json({ error: "Agent invocation failed" });
    }
  }
);

// ✅ Start Express Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});