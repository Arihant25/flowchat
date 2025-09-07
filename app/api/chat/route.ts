import { NextRequest, NextResponse } from "next/server";
import { streamChatCompletion } from "@/lib/ai-providers";
import { getAllProviderConfigs } from "@/lib/storage";
import { ChatRequest, ChatMessage } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const {
      message,
      conversationHistory = [],
      provider,
      model,
      providerId,
      temperature = 0.7,
      systemPrompt,
      providerConfig
    } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required and must be a string" },
        { status: 400 }
      );
    }

    if (!provider || !model || !providerId) {
      return NextResponse.json(
        { error: "Provider, model, and providerId are required" },
        { status: 400 }
      );
    }

    // Get provider configuration
    let config;

    if (providerConfig) {
      // Use the provider config sent from client (includes API keys)
      config = providerConfig;
    } else {
      // Fallback to server-side configs (for backward compatibility)
      const configs = await getAllProviderConfigs();
      config = configs.find(c => c.id === providerId);
    }

    if (!config) {
      return NextResponse.json(
        { error: "Provider configuration not found" },
        { status: 404 }
      );
    }

    // Build message history
    const messages: ChatMessage[] = [];

    // Add system prompt if provided
    if (systemPrompt?.trim()) {
      messages.push({
        role: "system",
        content: systemPrompt,
      });
    }

    // Add conversation history
    messages.push(...conversationHistory);

    // Add current message
    messages.push({
      role: "user",
      content: message,
    });

    console.log('Final messages array being sent to AI:', messages);

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamChatCompletion(messages, model, config, temperature)) {
            const data = `data: ${JSON.stringify(chunk)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }

          // Send completion signal
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error: any) {
          console.error("Streaming error:", error);
          const errorChunk = {
            content: "",
            isThinking: false,
            isComplete: true,
            error: error.message || "An unexpected error occurred",
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error: any) {
    console.error("Error in chat API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// API endpoint to get available providers and their models
export async function GET() {
  try {
    const configs = await getAllProviderConfigs();

    return NextResponse.json({
      providers: configs.map(config => ({
        id: config.id,
        name: config.name,
        provider: config.provider,
        isDefault: config.isDefault,
        defaultModel: config.defaultModel,
        hasApiKey: !!config.apiKey,
        baseUrl: config.baseUrl,
      })),
    });
  } catch (error: any) {
    console.error("Error getting providers:", error);
    return NextResponse.json(
      { error: "Failed to get providers" },
      { status: 500 }
    );
  }
}
