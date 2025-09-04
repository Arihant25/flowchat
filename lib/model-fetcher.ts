// Model fetching functionality for AI providers
import { AIProvider, ModelInfo, ProviderConfig, DEFAULT_MODELS } from "./types";
import { getCachedModels, saveCachedModels } from "./storage";

// Fetch models from OpenAI API
export async function fetchOpenAIModels(config: ProviderConfig): Promise<ModelInfo[]> {
    try {
        if (!config.apiKey) {
            return DEFAULT_MODELS.openai;
        }

        const response = await fetch("https://api.openai.com/v1/models", {
            headers: {
                "Authorization": `Bearer ${config.apiKey}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            console.warn("Failed to fetch OpenAI models, using defaults");
            return DEFAULT_MODELS.openai;
        }

        const data = await response.json();
        const models: ModelInfo[] = data.data
            .filter((model: any) => model.id.includes("gpt") || model.id.includes("text"))
            .map((model: any) => ({
                id: model.id,
                name: model.id.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
                provider: "openai" as AIProvider,
                contextLength: getOpenAIContextLength(model.id),
            }))
            .sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name));

        return models.length > 0 ? models : DEFAULT_MODELS.openai;
    } catch (error) {
        console.error("Error fetching OpenAI models:", error);
        return DEFAULT_MODELS.openai;
    }
}

// Fetch models from Anthropic API
export async function fetchAnthropicModels(config: ProviderConfig): Promise<ModelInfo[]> {
    try {
        if (!config.apiKey) {
            return DEFAULT_MODELS.anthropic;
        }

        // Anthropic doesn't have a public models endpoint, so we use the defaults
        // You could potentially test model availability by making a small request
        return DEFAULT_MODELS.anthropic;
    } catch (error) {
        console.error("Error fetching Anthropic models:", error);
        return DEFAULT_MODELS.anthropic;
    }
}

// Fetch models from Google Gemini API
export async function fetchGeminiModels(config: ProviderConfig): Promise<ModelInfo[]> {
    try {
        if (!config.apiKey) {
            return DEFAULT_MODELS.google;
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`);

        if (!response.ok) {
            console.warn("Failed to fetch Gemini models, using defaults");
            return DEFAULT_MODELS.google;
        }

        const data = await response.json();
        const models: ModelInfo[] = data.models
            .filter((model: any) => model.supportedGenerationMethods?.includes("generateContent"))
            .map((model: any) => ({
                id: model.name.replace("models/", ""),
                name: model.displayName || model.name.replace("models/", ""),
                provider: "google" as AIProvider,
                contextLength: model.inputTokenLimit || 1048576,
                description: model.description,
            }))
            .sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name));

        return models.length > 0 ? models : DEFAULT_MODELS.google;
    } catch (error) {
        console.error("Error fetching Gemini models:", error);
        return DEFAULT_MODELS.google;
    }
}

// Fetch models from Ollama API
export async function fetchOllamaModels(config: ProviderConfig): Promise<ModelInfo[]> {
    try {
        const baseUrl = config.baseUrl || "http://localhost:11434";
        const response = await fetch(`${baseUrl}/api/tags`);

        if (!response.ok) {
            console.warn("Failed to fetch Ollama models, server may not be running");
            return DEFAULT_MODELS.ollama;
        }

        const data = await response.json();
        const models: ModelInfo[] = data.models?.map((model: any) => ({
            id: model.name,
            name: model.name,
            provider: "ollama" as AIProvider,
            description: `Size: ${formatBytes(model.size || 0)}${model.modified_at ? ` | Modified: ${new Date(model.modified_at).toLocaleDateString()}` : ""}`,
        })) || [];

        return models.length > 0 ? models : DEFAULT_MODELS.ollama;
    } catch (error) {
        console.error("Error fetching Ollama models:", error);
        return DEFAULT_MODELS.ollama;
    }
}

// Fetch models from LM Studio API
export async function fetchLMStudioModels(config: ProviderConfig): Promise<ModelInfo[]> {
    try {
        const baseUrl = config.baseUrl || "http://localhost:1234";
        const response = await fetch(`${baseUrl}/v1/models`);

        if (!response.ok) {
            console.warn("Failed to fetch LM Studio models, server may not be running");
            return [];
        }

        const data = await response.json();
        const models: ModelInfo[] = data.data?.map((model: any) => ({
            id: model.id,
            name: model.id,
            provider: "lmstudio" as AIProvider,
            description: "Local model via LM Studio",
        })) || [];

        return models;
    } catch (error) {
        console.error("Error fetching LM Studio models:", error);
        return [];
    }
}

// Main function to fetch models for any provider
export async function fetchModelsForProvider(config: ProviderConfig, useCache = true): Promise<ModelInfo[]> {
    // Check cache first if requested
    if (useCache) {
        const cached = getCachedModels(config.provider);
        if (cached.length > 0) {
            return cached;
        }
    }

    let models: ModelInfo[] = [];

    switch (config.provider) {
        case "openai":
            models = await fetchOpenAIModels(config);
            break;
        case "anthropic":
            models = await fetchAnthropicModels(config);
            break;
        case "google":
            models = await fetchGeminiModels(config);
            break;
        case "ollama":
            models = await fetchOllamaModels(config);
            break;
        case "lmstudio":
            models = await fetchLMStudioModels(config);
            break;
        default:
            models = DEFAULT_MODELS[config.provider] || [];
    }

    // Cache the results only if we got models
    if (models.length > 0 && useCache) {
        saveCachedModels(config.provider, models);
    }

    return models;
}

// Fetch models for all configured providers
export async function fetchModelsForAllProviders(configs: ProviderConfig[]): Promise<Record<string, ModelInfo[]>> {
    const results: Record<string, ModelInfo[]> = {};

    for (const config of configs) {
        try {
            results[config.id] = await fetchModelsForProvider(config);
        } catch (error) {
            console.error(`Error fetching models for ${config.name}:`, error);
            results[config.id] = DEFAULT_MODELS[config.provider] || [];
        }
    }

    return results;
}

// Helper function to get OpenAI context lengths
function getOpenAIContextLength(modelId: string): number {
    if (modelId.includes("gpt-4o")) return 128000;
    if (modelId.includes("gpt-4-turbo")) return 128000;
    if (modelId.includes("gpt-4")) return 8192;
    if (modelId.includes("gpt-3.5-turbo")) return 16384;
    return 4096;
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Refresh models cache for a specific provider
export async function refreshModelsCache(config: ProviderConfig): Promise<ModelInfo[]> {
    return fetchModelsForProvider(config, false);
}

// Clear models cache for a specific provider
export function clearModelsCache(provider: AIProvider): void {
    saveCachedModels(provider, []);
}
