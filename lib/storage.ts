// Storage helper for conversations and provider configurations
import {
    ProviderConfig,
    UserPreferences,
    ModelInfo,
    CachedModels,
    DEFAULT_PROVIDER_CONFIGS,
    DEFAULT_USER_PREFERENCES,
    STORAGE_KEYS,
    CACHE_EXPIRATION_TIME,
    AIProvider
} from "./types";

export interface StoredConversation {
    id: string;
    title: string;
    nodes: any[];
    lastModified: string; // ISO
}

const DB_NAME = "flowchat";
const CONVERSATIONS_STORE = "conversations";
const PROVIDERS_STORE = "providers";
const DB_VERSION = 2;

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof window === "undefined" || !("indexedDB" in window)) {
            // For server-side, we'll use localStorage fallback or return empty data
            return reject(new Error("IndexedDB not available - running server-side"));
        }

        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;

            // Create conversations store
            if (!db.objectStoreNames.contains(CONVERSATIONS_STORE)) {
                db.createObjectStore(CONVERSATIONS_STORE, { keyPath: "id" });
            }

            // Create providers store
            if (!db.objectStoreNames.contains(PROVIDERS_STORE)) {
                db.createObjectStore(PROVIDERS_STORE, { keyPath: "id" });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// Conversation storage functions
export async function getAllConversations(): Promise<StoredConversation[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CONVERSATIONS_STORE, "readonly");
        const store = tx.objectStore(CONVERSATIONS_STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result as StoredConversation[]);
        req.onerror = () => reject(req.error);
    });
}

export async function putConversation(conv: StoredConversation): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CONVERSATIONS_STORE, "readwrite");
        const store = tx.objectStore(CONVERSATIONS_STORE);
        const req = store.put(conv);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function deleteConversation(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CONVERSATIONS_STORE, "readwrite");
        const store = tx.objectStore(CONVERSATIONS_STORE);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function clearAllConversations(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CONVERSATIONS_STORE, "readwrite");
        const store = tx.objectStore(CONVERSATIONS_STORE);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// Provider configuration storage functions
export async function getAllProviderConfigs(): Promise<ProviderConfig[]> {
    if (typeof window === "undefined") {
        // Server-side: return default configurations
        const defaultConfigs: ProviderConfig[] = [];
        const now = new Date().toISOString();

        for (const [providerType, defaultConfig] of Object.entries(DEFAULT_PROVIDER_CONFIGS)) {
            const config: ProviderConfig = {
                ...defaultConfig,
                id: `${providerType}_default`,
                createdAt: now,
                updatedAt: now,
            };
            defaultConfigs.push(config);
        }

        return defaultConfigs;
    }

    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(PROVIDERS_STORE, "readonly");
            const store = tx.objectStore(PROVIDERS_STORE);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result as ProviderConfig[]);
            req.onerror = () => reject(req.error);
        });
    } catch (error) {
        // Fallback to localStorage
        try {
            const stored = localStorage.getItem('flowchat_providers');
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.error("Error loading from localStorage:", e);
        }
        return [];
    }
}

export async function putProviderConfig(config: ProviderConfig): Promise<void> {
    if (typeof window === "undefined") {
        // Server-side: can't persist, just return
        return;
    }

    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(PROVIDERS_STORE, "readwrite");
            const store = tx.objectStore(PROVIDERS_STORE);
            const req = store.put(config);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (error) {
        // Fallback to localStorage
        try {
            const configs = await getAllProviderConfigs();
            const updatedConfigs = configs.filter(c => c.id !== config.id);
            updatedConfigs.push(config);
            localStorage.setItem('flowchat_providers', JSON.stringify(updatedConfigs));
        } catch (e) {
            console.error("Error saving to localStorage:", e);
        }
    }
}

export async function deleteProviderConfig(id: string): Promise<void> {
    if (typeof window === "undefined") {
        // Server-side: can't persist, just return
        return;
    }

    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(PROVIDERS_STORE, "readwrite");
            const store = tx.objectStore(PROVIDERS_STORE);
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (error) {
        // Fallback to localStorage
        try {
            const configs = await getAllProviderConfigs();
            const updatedConfigs = configs.filter(c => c.id !== id);
            localStorage.setItem('flowchat_providers', JSON.stringify(updatedConfigs));
        } catch (e) {
            console.error("Error deleting from localStorage:", e);
        }
    }
}

export async function clearAllProviderConfigs(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(PROVIDERS_STORE, "readwrite");
        const store = tx.objectStore(PROVIDERS_STORE);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// LocalStorage functions for user preferences and cached models
export function getUserPreferences(): UserPreferences {
    if (typeof window === "undefined") return DEFAULT_USER_PREFERENCES;

    try {
        const stored = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
        if (stored) {
            return { ...DEFAULT_USER_PREFERENCES, ...JSON.parse(stored) };
        }
    } catch (error) {
        console.error("Error loading user preferences:", error);
    }

    return DEFAULT_USER_PREFERENCES;
}

export function saveUserPreferences(preferences: Partial<UserPreferences>): void {
    if (typeof window === "undefined") return;

    try {
        const current = getUserPreferences();
        const updated = { ...current, ...preferences };
        localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(updated));
    } catch (error) {
        console.error("Error saving user preferences:", error);
    }
}

// Save last used provider and model
export function saveLastUsedProviderAndModel(providerId: string, model: string): void {
    if (typeof window === "undefined") return;

    try {
        saveUserPreferences({
            lastUsedProvider: providerId,
            lastUsedModel: model
        });
    } catch (error) {
        console.error("Error saving last used provider and model:", error);
    }
}

// Get last used provider and model
export function getLastUsedProviderAndModel(): { providerId: string; model: string } {
    if (typeof window === "undefined") return { providerId: "", model: "" };

    try {
        const preferences = getUserPreferences();
        const result = {
            providerId: preferences.lastUsedProvider || "",
            model: preferences.lastUsedModel || ""
        };
        return result;
    } catch (error) {
        console.error("Error getting last used provider and model:", error);
        return { providerId: "", model: "" };
    }
}

export function getCachedModels(provider: AIProvider): ModelInfo[] {
    if (typeof window === "undefined") return [];

    try {
        const stored = localStorage.getItem(`${STORAGE_KEYS.CACHED_MODELS}_${provider}`);
        if (stored) {
            const cachedData: CachedModels = JSON.parse(stored);

            // Check if cache is expired
            const now = Date.now();
            if (now - cachedData.timestamp < CACHE_EXPIRATION_TIME) {
                return cachedData.models;
            } else {
                // Cache expired, remove it
                localStorage.removeItem(`${STORAGE_KEYS.CACHED_MODELS}_${provider}`);
                return [];
            }
        }
    } catch (error) {
        console.error("Error loading cached models:", error);
        // Remove corrupted cache
        try {
            localStorage.removeItem(`${STORAGE_KEYS.CACHED_MODELS}_${provider}`);
        } catch (e) {
            console.error("Error removing corrupted cache:", e);
        }
    }

    return [];
}

export function saveCachedModels(provider: AIProvider, models: ModelInfo[]): void {
    if (typeof window === "undefined") return;

    try {
        const cachedData: CachedModels = {
            models,
            timestamp: Date.now(),
            version: 1
        };
        localStorage.setItem(`${STORAGE_KEYS.CACHED_MODELS}_${provider}`, JSON.stringify(cachedData));
    } catch (error) {
        console.error("Error saving cached models:", error);
    }
}

// Clear cached models for a specific provider
export function clearCachedModels(provider: AIProvider): void {
    if (typeof window === "undefined") return;

    try {
        localStorage.removeItem(`${STORAGE_KEYS.CACHED_MODELS}_${provider}`);
    } catch (error) {
        console.error("Error clearing cached models:", error);
    }
}

// Clear all cached models
export function clearAllCachedModels(): void {
    if (typeof window === "undefined") return;

    try {
        const providers: AIProvider[] = ["openai", "anthropic", "google", "ollama", "lmstudio"];
        providers.forEach(provider => {
            localStorage.removeItem(`${STORAGE_KEYS.CACHED_MODELS}_${provider}`);
        });
    } catch (error) {
        console.error("Error clearing all cached models:", error);
    }
}

// Check if any cached models are expired and clean them up
export function cleanupExpiredCache(): void {
    if (typeof window === "undefined") return;

    try {
        const providers: AIProvider[] = ["openai", "anthropic", "google", "ollama", "lmstudio"];
        const now = Date.now();

        providers.forEach(provider => {
            const stored = localStorage.getItem(`${STORAGE_KEYS.CACHED_MODELS}_${provider}`);
            if (stored) {
                try {
                    const cachedData: CachedModels = JSON.parse(stored);
                    if (now - cachedData.timestamp >= CACHE_EXPIRATION_TIME) {
                        localStorage.removeItem(`${STORAGE_KEYS.CACHED_MODELS}_${provider}`);
                        console.log(`Cleared expired cache for provider: ${provider}`);
                    }
                } catch (e) {
                    // Remove corrupted cache
                    localStorage.removeItem(`${STORAGE_KEYS.CACHED_MODELS}_${provider}`);
                }
            }
        });
    } catch (error) {
        console.error("Error cleaning up expired cache:", error);
    }
}

// Initialize default provider configurations (only create empty placeholders)
export async function initializeDefaultProviders(): Promise<void> {
    if (typeof window === "undefined") {
        // Server-side: nothing to initialize
        return;
    }

    try {
        const existingConfigs = await getAllProviderConfigs();

        // Only ensure we have minimal setup, don't create actual provider configs
        // The setup dialog will handle creating them when users actually configure providers
        if (existingConfigs.length === 0) {
            // We don't create any providers here anymore
            // They will be created through the setup dialog
        }
    } catch (error) {
        console.error("Error initializing default providers:", error);
    }
}

// Helper function to get the default provider config
export async function getDefaultProviderConfig(): Promise<ProviderConfig | null> {
    try {
        const configs = await getAllProviderConfigs();
        const preferences = getUserPreferences();

        // If user has a preferred default, use that
        if (preferences.defaultProvider) {
            const preferred = configs.find(c => c.id === preferences.defaultProvider);
            if (preferred) return preferred;
        }

        // Otherwise, find the first default or OpenAI config
        return configs.find(c => c.isDefault) || configs.find(c => c.provider === "openai") || configs[0] || null;
    } catch (error) {
        console.error("Error getting default provider config:", error);
        return null;
    }
}
