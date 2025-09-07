// Provider types and configurations

export type AIProvider = "openai" | "anthropic" | "google" | "ollama" | "lmstudio";

export interface ProviderConfig {
    id: string;
    provider: AIProvider;
    name: string;
    apiKey?: string;
    baseUrl?: string;
    isDefault: boolean;
    defaultModel?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ModelInfo {
    id: string;
    name: string;
    provider: AIProvider;
    contextLength?: number;
    description?: string;
}

export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
    thinking?: string;
    thinkingTime?: number;
    timestamp?: string;
}

export interface ChatRequest {
    message: string;
    conversationHistory: ChatMessage[];
    provider: AIProvider;
    model: string;
    providerId: string;
    temperature?: number;
    systemPrompt?: string;
    providerConfig?: ProviderConfig;
}

export interface StreamingResponse {
    content: string;
    thinking?: string;
    thinkingTime?: number;
    isThinking: boolean;
    isComplete: boolean;
    error?: string;
}

// Default provider configurations
export const DEFAULT_PROVIDER_CONFIGS: Record<AIProvider, Omit<ProviderConfig, "id" | "createdAt" | "updatedAt">> = {
    openai: {
        provider: "openai",
        name: "OpenAI",
        isDefault: true,
        defaultModel: "gpt-4o",
    },
    anthropic: {
        provider: "anthropic",
        name: "Anthropic",
        isDefault: false,
        defaultModel: "claude-3-5-sonnet-20241022",
    },
    google: {
        provider: "google",
        name: "Google Gemini",
        isDefault: false,
        defaultModel: "gemini-2.0-flash-exp",
    },
    ollama: {
        provider: "ollama",
        name: "Ollama",
        baseUrl: "http://localhost:11434",
        isDefault: false,
        defaultModel: "llama3.1",
    },
    lmstudio: {
        provider: "lmstudio",
        name: "LM Studio",
        baseUrl: "http://localhost:1234",
        isDefault: false,
    },
};

// Default models for each provider
export const DEFAULT_MODELS: Record<AIProvider, ModelInfo[]> = {
    openai: [
        { id: "gpt-4o", name: "GPT-4o", provider: "openai", contextLength: 128000 },
        { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai", contextLength: 128000 },
        { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "openai", contextLength: 128000 },
        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "openai", contextLength: 16384 },
    ],
    anthropic: [
        { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", provider: "anthropic", contextLength: 200000 },
        { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", provider: "anthropic", contextLength: 200000 },
        { id: "claude-3-opus-20240229", name: "Claude 3 Opus", provider: "anthropic", contextLength: 200000 },
    ],
    google: [
        { id: "gemini-2.0-flash-exp", name: "Gemini 2.0 Flash", provider: "google", contextLength: 1048576 },
        { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "google", contextLength: 2097152 },
        { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", provider: "google", contextLength: 1048576 },
    ],
    ollama: [
        { id: "llama3.1", name: "Llama 3.1", provider: "ollama" },
        { id: "llama3.1:8b", name: "Llama 3.1 8B", provider: "ollama" },
        { id: "llama3.1:70b", name: "Llama 3.1 70B", provider: "ollama" },
        { id: "qwen2.5", name: "Qwen 2.5", provider: "ollama" },
        { id: "mistral", name: "Mistral", provider: "ollama" },
        { id: "codellama", name: "Code Llama", provider: "ollama" },
    ],
    lmstudio: [],
};

// Storage keys
export const STORAGE_KEYS = {
    PROVIDER_CONFIGS: "flowchat_provider_configs",
    USER_PREFERENCES: "flowchat_user_preferences",
    CACHED_MODELS: "flowchat_cached_models",
} as const;

export interface UserPreferences {
    defaultProvider: string; // Provider config ID
    temperature: number;
    systemPrompt: string;
    fontFamily: string;
    theme: "light" | "dark" | "system";
    lastUsedProvider: string; // Last used provider config ID
    lastUsedModel: string; // Last used model ID
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
    defaultProvider: "",
    temperature: 0.7,
    systemPrompt: "",
    fontFamily: "inter",
    theme: "system",
    lastUsedProvider: "",
    lastUsedModel: "",
};
