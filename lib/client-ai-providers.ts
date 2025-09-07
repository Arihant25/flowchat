// Client-side AI Provider service for local providers (LM Studio, Ollama)
// These run directly in the browser and can connect to localhost
import {
    ProviderConfig,
    ChatMessage,
    StreamingResponse,
} from "./types";

// Client-side streaming for LM Studio
export async function* streamLMStudioClient(
    messages: ChatMessage[],
    model: string,
    config: ProviderConfig,
    temperature = 0.7
): AsyncGenerator<StreamingResponse> {
    try {
        const baseUrl = config.baseUrl || "http://localhost:1234";

        const formattedMessages = messages.map(msg => ({
            role: msg.role,
            content: msg.content,
        }));

        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                // Add CORS headers for local requests
            },
            body: JSON.stringify({
                model,
                messages: formattedMessages,
                temperature,
                stream: true,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            throw new Error(`LM Studio API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error("Failed to get response reader");
        }

        let content = "";
        let thinking = "";
        let isThinking = false;
        let thinkingStartTime: number | null = null;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split("\n").filter(line => line.startsWith("data: "));

                for (const line of lines) {
                    const data = line.replace("data: ", "");
                    if (data === "[DONE]") continue;

                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices?.[0]?.delta?.content || "";

                        if (delta) {
                            // Check for thinking tags
                            if (delta.includes("<think>")) {
                                isThinking = true;
                                thinkingStartTime = Date.now();
                                const parts = delta.split("<think>");
                                content += parts[0];
                                thinking += parts[1] || "";
                            } else if (delta.includes("</think>")) {
                                isThinking = false;
                                const parts = delta.split("</think>");
                                thinking += parts[0] || "";
                                content += parts[1] || "";
                            } else if (isThinking) {
                                thinking += delta;
                            } else {
                                content += delta;
                            }

                            yield {
                                content,
                                thinking: thinking || undefined,
                                isThinking,
                                isComplete: false,
                                thinkingTime: thinkingStartTime ? Math.floor((Date.now() - thinkingStartTime) / 1000) : undefined,
                            };
                        }
                    } catch (e) {
                        // Ignore JSON parse errors for partial chunks
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        yield {
            content,
            thinking: thinking || undefined,
            isThinking: false,
            isComplete: true,
            thinkingTime: thinkingStartTime ? Math.floor((Date.now() - thinkingStartTime) / 1000) : undefined,
        };
    } catch (error: any) {
        // Provide more helpful error messages for common connection issues
        let errorMessage = error.message || "Failed to get response from LM Studio";
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            const url = config.baseUrl || "http://localhost:1234";
            errorMessage = `Cannot connect to LM Studio at ${url}. Please ensure:
1. LM Studio is running
2. A model is loaded
3. The server is accessible at ${url}
4. CORS is enabled in LM Studio settings`;
        }
        
        yield {
            content: "",
            isThinking: false,
            isComplete: true,
            error: errorMessage,
        };
    }
}

// Client-side streaming for Ollama
export async function* streamOllamaClient(
    messages: ChatMessage[],
    model: string,
    config: ProviderConfig,
    temperature = 0.7
): AsyncGenerator<StreamingResponse> {
    try {
        const baseUrl = config.baseUrl || "http://localhost:11434";

        const formattedMessages = messages.map(msg => ({
            role: msg.role,
            content: msg.content,
        }));

        const response = await fetch(`${baseUrl}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model,
                messages: formattedMessages,
                stream: true,
                options: { temperature },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error("Failed to get response reader");
        }

        let content = "";
        let thinking = "";
        let isThinking = false;
        let thinkingStartTime: number | null = null;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split("\n").filter(line => line.trim());

                for (const line of lines) {
                    try {
                        const data = JSON.parse(line);
                        if (data.message?.content) {
                            const text = data.message.content;

                            // Check for thinking tags
                            if (text.includes("<think>")) {
                                isThinking = true;
                                thinkingStartTime = Date.now();
                                const parts = text.split("<think>");
                                content += parts[0];
                                thinking += parts[1] || "";
                            } else if (text.includes("</think>")) {
                                isThinking = false;
                                const parts = text.split("</think>");
                                thinking += parts[0] || "";
                                content += parts[1] || "";
                            } else if (isThinking) {
                                thinking += text;
                            } else {
                                content += text;
                            }

                            yield {
                                content,
                                thinking: thinking || undefined,
                                isThinking,
                                isComplete: data.done || false,
                                thinkingTime: thinkingStartTime ? Math.floor((Date.now() - thinkingStartTime) / 1000) : undefined,
                            };
                        }
                    } catch (e) {
                        // Ignore JSON parse errors for partial chunks
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        yield {
            content,
            thinking: thinking || undefined,
            isThinking: false,
            isComplete: true,
            thinkingTime: thinkingStartTime ? Math.floor((Date.now() - thinkingStartTime) / 1000) : undefined,
        };
    } catch (error: any) {
        // Provide more helpful error messages for common connection issues
        let errorMessage = error.message || "Failed to get response from Ollama";
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            const url = config.baseUrl || "http://localhost:11434";
            errorMessage = `Cannot connect to Ollama at ${url}. Please ensure:
1. Ollama is running
2. The model '${model}' is available (run: ollama pull ${model})
3. The server is accessible at ${url}`;
        }
        
        yield {
            content: "",
            isThinking: false,
            isComplete: true,
            error: errorMessage,
        };
    }
}

// Main client-side streaming function
export async function* streamChatCompletionClient(
    messages: ChatMessage[],
    model: string,
    config: ProviderConfig,
    temperature = 0.7
): AsyncGenerator<StreamingResponse> {
    switch (config.provider) {
        case "lmstudio":
            yield* streamLMStudioClient(messages, model, config, temperature);
            break;
        case "ollama":
            yield* streamOllamaClient(messages, model, config, temperature);
            break;
        default:
            yield {
                content: "",
                isThinking: false,
                isComplete: true,
                error: `Client-side streaming not supported for provider: ${config.provider}. This provider should use server-side API.`,
            };
    }
}

// Helper function to determine if provider should use client-side streaming
export function shouldUseClientSideStreaming(provider: string): boolean {
    return ["lmstudio", "ollama"].includes(provider);
}
