// AI Provider service layer with streaming support
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
    AIProvider,
    ProviderConfig,
    ChatMessage,
    StreamingResponse,
    ModelInfo,
    DEFAULT_MODELS
} from "./types";

// Provider client instances
let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;
let googleClient: GoogleGenerativeAI | null = null;

// Initialize provider clients
export function initializeProviderClient(config: ProviderConfig): void {
    switch (config.provider) {
        case "openai":
            if (config.apiKey) {
                openaiClient = new OpenAI({
                    apiKey: config.apiKey,
                    baseURL: config.baseUrl || "https://api.openai.com/v1",
                });
            }
            break;
        case "anthropic":
            if (config.apiKey) {
                anthropicClient = new Anthropic({
                    apiKey: config.apiKey,
                    baseURL: config.baseUrl || "https://api.anthropic.com",
                });
            }
            break;
        case "google":
            if (config.apiKey) {
                googleClient = new GoogleGenerativeAI(config.apiKey);
            }
            break;
    }
}

// Stream chat completion from OpenAI
export async function* streamOpenAI(
    messages: ChatMessage[],
    model: string,
    config: ProviderConfig,
    temperature = 0.7
): AsyncGenerator<StreamingResponse> {
    if (!openaiClient) {
        initializeProviderClient(config);
    }

    if (!openaiClient) {
        throw new Error("OpenAI client not initialized. Please check your API key.");
    }

    try {
        const formattedMessages = messages.map(msg => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content,
        }));

        const stream = await openaiClient.chat.completions.create({
            model,
            messages: formattedMessages,
            temperature,
            stream: true,
        });

        let content = "";
        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || "";
            content += delta;

            yield {
                content,
                isThinking: false,
                isComplete: false,
            };
        }

        yield {
            content,
            isThinking: false,
            isComplete: true,
        };
    } catch (error: any) {
        yield {
            content: "",
            isThinking: false,
            isComplete: true,
            error: error.message || "Failed to get response from OpenAI",
        };
    }
}

// Stream chat completion from Anthropic
export async function* streamAnthropic(
    messages: ChatMessage[],
    model: string,
    config: ProviderConfig,
    temperature = 0.7
): AsyncGenerator<StreamingResponse> {
    if (!anthropicClient) {
        initializeProviderClient(config);
    }

    if (!anthropicClient) {
        throw new Error("Anthropic client not initialized. Please check your API key.");
    }

    try {
        // Separate system message from conversation messages
        const systemMessage = messages.find(m => m.role === "system");
        const conversationMessages = messages.filter(m => m.role !== "system");

        const formattedMessages = conversationMessages.map(msg => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
        }));

        const stream = await anthropicClient.messages.create({
            model,
            messages: formattedMessages,
            max_tokens: 4096,
            temperature,
            system: systemMessage?.content || undefined,
            stream: true,
        });

        let content = "";
        let thinking = "";
        let isThinking = false;
        let thinkingStartTime: number | null = null;

        for await (const chunk of stream) {
            if (chunk.type === "content_block_start") {
                if (chunk.content_block.type === "text") {
                    // Regular content block
                    isThinking = false;
                }
            } else if (chunk.type === "content_block_delta") {
                if (chunk.delta.type === "text_delta") {
                    const text = chunk.delta.text;

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
                        isComplete: false,
                        thinkingTime: thinkingStartTime ? Math.floor((Date.now() - thinkingStartTime) / 1000) : undefined,
                    };
                }
            }
        }

        yield {
            content,
            thinking: thinking || undefined,
            isThinking: false,
            isComplete: true,
            thinkingTime: thinkingStartTime ? Math.floor((Date.now() - thinkingStartTime) / 1000) : undefined,
        };
    } catch (error: any) {
        yield {
            content: "",
            isThinking: false,
            isComplete: true,
            error: error.message || "Failed to get response from Anthropic",
        };
    }
}

// Stream chat completion from Google Gemini
export async function* streamGemini(
    messages: ChatMessage[],
    model: string,
    config: ProviderConfig,
    temperature = 0.7
): AsyncGenerator<StreamingResponse> {
    if (!googleClient) {
        initializeProviderClient(config);
    }

    if (!googleClient) {
        throw new Error("Google client not initialized. Please check your API key.");
    }

    try {
        const geminiModel = googleClient.getGenerativeModel({
            model,
            generationConfig: { temperature }
        });

        // Format messages for Gemini
        const systemMessage = messages.find(m => m.role === "system");
        const conversationMessages = messages.filter(m => m.role !== "system");

        // Build conversation history
        const history = conversationMessages.slice(0, -1).map(msg => ({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }],
        }));

        const lastMessage = conversationMessages[conversationMessages.length - 1];

        const chat = geminiModel.startChat({
            history,
            systemInstruction: systemMessage?.content,
        });

        const result = await chat.sendMessageStream(lastMessage?.content || "");

        let content = "";
        let thinking = "";
        let isThinking = false;
        let thinkingStartTime: number | null = null;

        for await (const chunk of result.stream) {
            const text = chunk.text() || "";

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
                isComplete: false,
                thinkingTime: thinkingStartTime ? Math.floor((Date.now() - thinkingStartTime) / 1000) : undefined,
            };
        }

        yield {
            content,
            thinking: thinking || undefined,
            isThinking: false,
            isComplete: true,
            thinkingTime: thinkingStartTime ? Math.floor((Date.now() - thinkingStartTime) / 1000) : undefined,
        };
    } catch (error: any) {
        yield {
            content: "",
            isThinking: false,
            isComplete: true,
            error: error.message || "Failed to get response from Google Gemini",
        };
    }
}

// Stream chat completion from Ollama
export async function* streamOllama(
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
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
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
        yield {
            content: "",
            isThinking: false,
            isComplete: true,
            error: error.message || "Failed to get response from Ollama",
        };
    }
}

// Stream chat completion from LM Studio
export async function* streamLMStudio(
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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model,
                messages: formattedMessages,
                temperature,
                stream: true,
            }),
        });

        if (!response.ok) {
            throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
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
        yield {
            content: "",
            isThinking: false,
            isComplete: true,
            error: error.message || "Failed to get response from LM Studio",
        };
    }
}

// Main streaming function that routes to the appropriate provider
export async function* streamChatCompletion(
    messages: ChatMessage[],
    model: string,
    config: ProviderConfig,
    temperature = 0.7
): AsyncGenerator<StreamingResponse> {
    switch (config.provider) {
        case "openai":
            yield* streamOpenAI(messages, model, config, temperature);
            break;
        case "anthropic":
            yield* streamAnthropic(messages, model, config, temperature);
            break;
        case "google":
            yield* streamGemini(messages, model, config, temperature);
            break;
        case "ollama":
            yield* streamOllama(messages, model, config, temperature);
            break;
        case "lmstudio":
            yield* streamLMStudio(messages, model, config, temperature);
            break;
        default:
            yield {
                content: "",
                isThinking: false,
                isComplete: true,
                error: `Unsupported provider: ${config.provider}`,
            };
    }
}
