"use client";

import { useState, useEffect, useCallback, useRef, memo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw, Settings } from "lucide-react";
import { ModelInfo } from "@/lib/types";
interface APIProviderConfig {
    id: string;
    name: string;
    provider: string;
    isDefault: boolean;
    defaultModel?: string;
    hasApiKey: boolean;
    baseUrl?: string;
}

interface ProviderModelSelectorProps {
    selectedProviderId: string;
    selectedModel: string;
    onProviderChange: (providerId: string) => void;
    onModelChange: (model: string) => void;
    className?: string;
}

export default memo(function ProviderModelSelector({
    selectedProviderId,
    selectedModel,
    onProviderChange,
    onModelChange,
    className = "",
}: ProviderModelSelectorProps) {
    const [providers, setProviders] = useState<APIProviderConfig[]>([]);
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [loadingProviders, setLoadingProviders] = useState(false);
    const [loadingModels, setLoadingModels] = useState(false);
    const [hasLoadedProviders, setHasLoadedProviders] = useState(false);
    const [hasInitialized, setHasInitialized] = useState(false);
    const loadingModelsRef = useRef(false);
    const mounted = useRef(true);

    // Simple function to load providers - not memoized to avoid dependency issues
    const loadProviders = async () => {
        if (hasLoadedProviders || loadingProviders) return;

        try {
            setLoadingProviders(true);
            const response = await fetch("/api/chat");
            if (!mounted.current) return;

            if (response.ok) {
                const data = await response.json();
                setProviders(data.providers || []);
                setHasLoadedProviders(true);

                // If no provider is selected, select the first default one
                if (!selectedProviderId && data.providers?.length > 0) {
                    const defaultProvider = data.providers.find((p: any) => p.isDefault) || data.providers[0];
                    onProviderChange(defaultProvider.id);
                }
            }
        } catch (error) {
            console.error("Failed to load providers:", error);
        } finally {
            if (mounted.current) {
                setLoadingProviders(false);
            }
        }
    };

    // Simple function to load models - not memoized to avoid dependency issues
    const loadModelsForProvider = async (providerId: string, refresh = false) => {
        if (loadingModelsRef.current && !refresh) return;

        try {
            loadingModelsRef.current = true;
            setLoadingModels(true);

            // Only clear models and selection when switching providers, not on refresh
            if (!refresh) {
                setModels([]);
                if (selectedModel) {
                    onModelChange("");
                }
            }

            const response = await fetch(`/api/models?providerId=${providerId}&refresh=${refresh}`);
            if (!mounted.current) return;

            if (response.ok) {
                const data = await response.json();
                setModels(data.models || []);

                // Auto-select default model only if no model is currently selected
                if (!selectedModel && data.models?.length > 0 && !refresh) {
                    const provider = providers.find(p => p.id === providerId);
                    const defaultModel = provider?.defaultModel || data.models[0]?.id;
                    if (defaultModel) {
                        onModelChange(defaultModel);
                    }
                }
            }
        } catch (error) {
            console.error("Failed to load models:", error);
        } finally {
            if (mounted.current) {
                setLoadingModels(false);
                loadingModelsRef.current = false;
            }
        }
    };

    // Load providers on component mount
    useEffect(() => {
        mounted.current = true;
        if (!hasInitialized) {
            setHasInitialized(true);
            loadProviders();
        }
        return () => {
            mounted.current = false;
        };
    }, []);

    // Load models when provider changes and providers are loaded
    useEffect(() => {
        if (selectedProviderId && hasLoadedProviders && providers.length > 0) {
            loadModelsForProvider(selectedProviderId);
        }
    }, [selectedProviderId, hasLoadedProviders, providers.length]);

    // Memoize the refresh function to prevent unnecessary re-renders
    const refreshModels = useCallback(() => {
        if (selectedProviderId) {
            loadModelsForProvider(selectedProviderId, true);
        }
    }, [selectedProviderId]);

    const selectedProvider = providers.find(p => p.id === selectedProviderId);

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {/* Provider Selector */}
            <Select
                value={selectedProviderId}
                onValueChange={onProviderChange}
                disabled={loadingProviders}
            >
                <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                    {providers.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                            <div className="flex items-center gap-2">
                                <span>{provider.name}</span>
                                {!provider.hasApiKey && provider.provider !== "ollama" && provider.provider !== "lmstudio" && (
                                    <span className="text-xs text-yellow-600">⚠ No API key</span>
                                )}
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Model Selector */}
            <Select
                value={selectedModel}
                onValueChange={onModelChange}
                disabled={loadingModels || !selectedProviderId}
            >
                <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                    {models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                            <div className="flex flex-col">
                                <span>{model.name}</span>
                                {model.description && (
                                    <span className="text-xs text-muted-foreground">{model.description}</span>
                                )}
                                {model.contextLength && (
                                    <span className="text-xs text-muted-foreground">
                                        Context: {model.contextLength.toLocaleString()} tokens
                                    </span>
                                )}
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Refresh Models Button */}
            <Button
                variant="outline"
                size="sm"
                onClick={refreshModels}
                disabled={loadingModels || !selectedProviderId}
                title="Refresh models"
            >
                <RefreshCw className={`w-4 h-4 ${loadingModels ? "animate-spin" : ""}`} />
            </Button>

            {/* Settings Button */}
            <Button
                variant="outline"
                size="sm"
                onClick={() => window.open("/settings", "_blank")}
                title="Open settings"
            >
                <Settings className="w-4 h-4" />
            </Button>
        </div>
    );
});
