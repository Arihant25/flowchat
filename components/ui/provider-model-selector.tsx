"use client";

import { useState, useEffect } from "react";
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

export default function ProviderModelSelector({
    selectedProviderId,
    selectedModel,
    onProviderChange,
    onModelChange,
    className = "",
}: ProviderModelSelectorProps) {
    const [providers, setProviders] = useState<APIProviderConfig[]>([]);
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [loadingProviders, setLoadingProviders] = useState(true);
    const [loadingModels, setLoadingModels] = useState(false);

    // Load providers on component mount
    useEffect(() => {
        loadProviders();
    }, []);

    // Load models when provider changes
    useEffect(() => {
        if (selectedProviderId) {
            loadModelsForProvider(selectedProviderId);
        } else {
            // Clear models when no provider is selected
            setModels([]);
        }
    }, [selectedProviderId]);

    const loadProviders = async () => {
        try {
            setLoadingProviders(true);
            const response = await fetch("/api/chat");
            if (response.ok) {
                const data = await response.json();
                setProviders(data.providers || []);

                // If no provider is selected, select the first default one
                if (!selectedProviderId && data.providers?.length > 0) {
                    const defaultProvider = data.providers.find((p: any) => p.isDefault) || data.providers[0];
                    onProviderChange(defaultProvider.id);
                }
            }
        } catch (error) {
            console.error("Failed to load providers:", error);
        } finally {
            setLoadingProviders(false);
        }
    };

    const loadModelsForProvider = async (providerId: string, refresh = false) => {
        try {
            setLoadingModels(true);
            // Clear current model selection when switching providers
            if (!refresh) {
                onModelChange("");
                setModels([]);
            }

            const response = await fetch(`/api/models?providerId=${providerId}&refresh=${refresh}`);
            if (response.ok) {
                const data = await response.json();
                setModels(data.models || []);

                // If no model is selected, select the default one for this provider
                if (!selectedModel && data.models?.length > 0) {
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
            setLoadingModels(false);
        }
    };

    const refreshModels = () => {
        if (selectedProviderId) {
            loadModelsForProvider(selectedProviderId, true);
        }
    };

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
}
