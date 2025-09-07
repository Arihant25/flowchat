"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { AIProvider, ProviderConfig, DEFAULT_PROVIDER_CONFIGS } from "@/lib/types";
import { putProviderConfig } from "@/lib/storage";

interface ProviderSetupDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onProviderConfigured: () => void;
}

type SetupStep = 'selection' | 'configuration';

const providers = [
    {
        id: 'openai' as AIProvider,
        name: 'OpenAI',
        icon: '🤖',
        needsApiKey: true,
        placeholder: 'sk-...'
    },
    {
        id: 'anthropic' as AIProvider,
        name: 'Anthropic',
        icon: '🧠',
        needsApiKey: true,
        placeholder: 'sk-ant-...'
    },
    {
        id: 'google' as AIProvider,
        name: 'Google',
        icon: '🔍',
        needsApiKey: true,
        placeholder: 'AI...'
    },
    {
        id: 'ollama' as AIProvider,
        name: 'Ollama',
        icon: '🦙',
        needsApiKey: false,
        needsBaseUrl: true,
        defaultUrl: 'http://localhost:11434'
    },
    {
        id: 'lmstudio' as AIProvider,
        name: 'LM Studio',
        icon: '🎛️',
        needsApiKey: false,
        needsBaseUrl: true,
        defaultUrl: 'http://localhost:1234'
    }
];

export default function ProviderSetupDialog({
    isOpen,
    onClose,
    onProviderConfigured
}: ProviderSetupDialogProps) {
    const [step, setStep] = useState<SetupStep>('selection');
    const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
    const [apiKey, setApiKey] = useState("");
    const [baseUrl, setBaseUrl] = useState("");
    const [isConfiguring, setIsConfiguring] = useState(false);

    if (!isOpen) return null;

    const handleProviderSelect = (provider: AIProvider) => {
        setSelectedProvider(provider);
        setApiKey("");

        const providerConfig = providers.find(p => p.id === provider);
        if (providerConfig?.defaultUrl) {
            setBaseUrl(providerConfig.defaultUrl);
        } else {
            setBaseUrl("");
        }

        setStep('configuration');
    };

    const handleBack = () => {
        setStep('selection');
        setSelectedProvider(null);
        setApiKey("");
        setBaseUrl("");
    };

    const handleConfigure = async () => {
        if (!selectedProvider) return;

        setIsConfiguring(true);

        try {
            const defaultConfig = DEFAULT_PROVIDER_CONFIGS[selectedProvider];
            const newConfig: ProviderConfig = {
                ...defaultConfig,
                id: `${selectedProvider}_${Date.now()}`,
                apiKey: apiKey || undefined,
                baseUrl: baseUrl || defaultConfig.baseUrl,
                isDefault: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            await putProviderConfig(newConfig);
            onProviderConfigured();
            onClose();
        } catch (error) {
            console.error("Failed to configure provider:", error);
            alert("Failed to configure provider. Please try again.");
        } finally {
            setIsConfiguring(false);
        }
    };

    const selectedProviderConfig = providers.find(p => p.id === selectedProvider);
    const isValid = selectedProviderConfig?.needsApiKey ? apiKey.trim() : true;

    if (step === 'selection') {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <Card className="w-full max-w-2xl">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl">Choose Your AI Provider</CardTitle>
                        <CardDescription>
                            Select a provider to start chatting with AI
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {providers.map((provider) => (
                                <Card
                                    key={provider.id}
                                    className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/50"
                                    onClick={() => handleProviderSelect(provider.id)}
                                >
                                    <CardContent className="p-6 text-center space-y-3">
                                        <div className="text-4xl">{provider.icon}</div>
                                        <div>
                                            <h3 className="font-semibold text-lg">{provider.name}</h3>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <div className="flex justify-center mt-6">
                            <Button variant="outline" onClick={onClose}>
                                Skip for Now
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleBack}
                            className="p-1"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <div className="text-center flex-1">
                            <div className="text-2xl mb-2">{selectedProviderConfig?.icon}</div>
                            <CardTitle>Configure {selectedProviderConfig?.name}</CardTitle>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {selectedProviderConfig?.needsApiKey && (
                        <div className="space-y-2">
                            <Label htmlFor="api-key">API Key</Label>
                            <Input
                                id="api-key"
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={selectedProviderConfig.placeholder}
                            />
                            <p className="text-xs text-muted-foreground">
                                Your API key is stored locally and never shared.
                            </p>
                        </div>
                    )}

                    {selectedProviderConfig?.needsBaseUrl && (
                        <div className="space-y-2">
                            <Label htmlFor="base-url">Base URL</Label>
                            <Input
                                id="base-url"
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                                placeholder={selectedProviderConfig.defaultUrl}
                            />
                            <p className="text-xs text-muted-foreground">
                                Make sure {selectedProviderConfig.name} is running locally.
                            </p>
                        </div>
                    )}

                    <div className="flex gap-2 pt-4">
                        <Button
                            variant="outline"
                            onClick={handleBack}
                            className="flex-1"
                        >
                            Back
                        </Button>
                        <Button
                            onClick={handleConfigure}
                            disabled={!isValid || isConfiguring}
                            className="flex-1"
                        >
                            {isConfiguring ? (
                                "Configuring..."
                            ) : (
                                <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Configure
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
