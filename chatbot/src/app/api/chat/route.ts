import { NextRequest } from "next/server";
import { getClient, SYSTEM_PROMPT } from "@/lib/claude";
import { TOOL_DEFINITIONS, executeTool } from "@/lib/tools";
import type Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

interface ChatRequestBody {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequestBody = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "Messages array is required" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const client = getClient();

    // Convert messages to Anthropic format
    const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Run the tool-use loop
    let response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS,
      messages: anthropicMessages,
    });

    // Collect tool data for the frontend
    const toolResults: Array<{ tool: string; input: unknown; result: unknown }> = [];

    // Tool-use loop: keep running tools until Claude gives a final text response
    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      const toolResultContents: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        try {
          const result = executeTool(
            toolUse.name,
            toolUse.input as Record<string, unknown>
          );

          // Truncate large results to avoid token limits
          const resultStr = JSON.stringify(result);
          const truncated =
            resultStr.length > 15000
              ? JSON.stringify({
                  _truncated: true,
                  _total_results: Array.isArray(result)
                    ? (result as unknown[]).length
                    : undefined,
                  results: Array.isArray(result)
                    ? (result as unknown[]).slice(0, 20)
                    : result,
                })
              : resultStr;

          toolResults.push({
            tool: toolUse.name,
            input: toolUse.input,
            result: JSON.parse(truncated),
          });

          toolResultContents.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: truncated,
          });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          toolResultContents.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: errorMsg }),
            is_error: true,
          });
        }
      }

      // Continue conversation with tool results
      anthropicMessages.push({ role: "assistant", content: response.content });
      anthropicMessages.push({ role: "user", content: toolResultContents });

      response = await client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: TOOL_DEFINITIONS,
        messages: anthropicMessages,
      });
    }

    // Extract final text response
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    const text = textBlocks.map((b) => b.text).join("\n");

    return Response.json({
      content: text,
      toolResults: toolResults.length > 0 ? toolResults : undefined,
    });
  } catch (err) {
    console.error("Chat API error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
