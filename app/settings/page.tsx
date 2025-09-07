"use client";

import { useState, useEffect } from "react";
import NavBar from "../components/NavBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Download, Upload, Trash2, Plus, Settings as SettingsIcon, X, RefreshCw } from "lucide-react";
import {
  ProviderConfig,
  UserPreferences,
  AIProvider,
  DEFAULT_PROVIDER_CONFIGS,
  ModelInfo
} from "@/lib/types";
import {
  getAllProviderConfigs,
  putProviderConfig,
  deleteProviderConfig,
  getUserPreferences,
  saveUserPreferences,
  initializeDefaultProviders
} from "@/lib/storage";
import { fetchModelsForProvider } from "@/lib/model-fetcher";

type FontFamily = "inter" | "geist" | "jetbrains" | "poppins" | "roboto";

export default function Settings() {
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfig[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>();
  const [selectedConfig, setSelectedConfig] = useState<ProviderConfig | null>(null);
  const [isAddingProvider, setIsAddingProvider] = useState(false);
  const [newProviderType, setNewProviderType] = useState<AIProvider>("openai");
  const [loading, setLoading] = useState(true);
  const [availableModels, setAvailableModels] = useState<Record<string, ModelInfo[]>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      await initializeDefaultProviders();

      const configs = await getAllProviderConfigs();
      const preferences = getUserPreferences();

      setProviderConfigs(configs);
      setUserPreferences(preferences);

      // Load models for each provider
      const models: Record<string, ModelInfo[]> = {};
      for (const config of configs) {
        try {
          models[config.id] = await fetchModelsForProvider(config);
        } catch (error) {
          console.error(`Failed to load models for ${config.name}:`, error);
          models[config.id] = [];
        }
      }
      setAvailableModels(models);
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserPreferences = (updates: Partial<UserPreferences>) => {
    if (!userPreferences) return;

    const updated = { ...userPreferences, ...updates };
    setUserPreferences(updated);
    saveUserPreferences(updated);
  };

  const addProvider = async () => {
    const newConfig: ProviderConfig = {
      ...DEFAULT_PROVIDER_CONFIGS[newProviderType],
      id: `${newProviderType}_${Date.now()}`,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await putProviderConfig(newConfig);
    setProviderConfigs([...providerConfigs, newConfig]);
    setSelectedConfig(newConfig);
    setIsAddingProvider(false);

    // Load models for the new provider
    try {
      const models = await fetchModelsForProvider(newConfig);
      setAvailableModels(prev => ({ ...prev, [newConfig.id]: models }));
    } catch (error) {
      console.error(`Failed to load models for ${newConfig.name}:`, error);
      setAvailableModels(prev => ({ ...prev, [newConfig.id]: [] }));
    }
  };

  const refreshModelsForProvider = async (config: ProviderConfig) => {
    try {
      const models = await fetchModelsForProvider(config, false); // Don't use cache
      setAvailableModels(prev => ({ ...prev, [config.id]: models }));
    } catch (error) {
      console.error(`Failed to refresh models for ${config.name}:`, error);
    }
  };

  const updateProvider = async (config: ProviderConfig) => {
    const updated = { ...config, updatedAt: new Date().toISOString() };
    await putProviderConfig(updated);

    setProviderConfigs(configs =>
      configs.map(c => c.id === config.id ? updated : c)
    );

    if (selectedConfig?.id === config.id) {
      setSelectedConfig(updated);
    }

    // Refresh models for the updated provider
    try {
      const models = await fetchModelsForProvider(updated, false); // Don't use cache
      setAvailableModels(prev => ({ ...prev, [updated.id]: models }));
    } catch (error) {
      console.error(`Failed to refresh models for ${updated.name}:`, error);
    }
  };

  const removeProvider = async (configId: string) => {
    if (confirm("Are you sure you want to remove this provider configuration?")) {
      await deleteProviderConfig(configId);
      setProviderConfigs(configs => configs.filter(c => c.id !== configId));

      if (selectedConfig?.id === configId) {
        setSelectedConfig(null);
      }
    }
  };

  const exportSettings = () => {
    const settings = {
      providerConfigs: providerConfigs.map(config => ({
        ...config,
        apiKey: config.apiKey ? "***HIDDEN***" : undefined, // Don't export API keys
      })),
      userPreferences,
    };
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flowchat-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const settings = JSON.parse(e.target?.result as string);

          if (settings.userPreferences) {
            updateUserPreferences(settings.userPreferences);
          }

          // Note: We don't import provider configs to avoid overwriting API keys
          alert("Settings imported successfully! Provider configurations are not imported for security reasons.");
        } catch (error) {
          console.error("Failed to import settings:", error);
          alert("Failed to import settings. Please check the file format.");
        }
      };
      reader.readAsText(file);
    }
  };

  const clearAllData = () => {
    if (confirm("Are you sure you want to clear all chat history? This cannot be undone.")) {
      localStorage.clear();
      if (typeof window !== "undefined" && "indexedDB" in window) {
        indexedDB.databases().then(databases => {
          databases.forEach(db => {
            if (db.name) indexedDB.deleteDatabase(db.name);
          });
        });
      }
      alert("All data has been cleared.");
    }
  };

  if (loading) {
    return (
      <>
        <NavBar />
        <div className="min-h-screen bg-background pt-20 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-background pt-20">
        <div className="container mx-auto px-6 py-8 max-w-6xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground mt-2">Manage your Flow Chat preferences and AI providers</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Provider List */}
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    AI Providers
                    <Button
                      size="sm"
                      onClick={() => setIsAddingProvider(true)}
                      disabled={isAddingProvider}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  </CardTitle>
                  <CardDescription>Configure your AI model providers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {providerConfigs.map((config) => (
                    <div
                      key={config.id}
                      className={`p-3 rounded border cursor-pointer transition-colors ${selectedConfig?.id === config.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                        }`}
                      onClick={() => setSelectedConfig(config)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{config.name}</div>
                          <div className="text-sm text-muted-foreground capitalize">
                            {config.provider}
                            {config.isDefault && " (Default)"}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {config.apiKey && (
                            <div className="w-2 h-2 bg-green-500 rounded-full" title="API key configured" />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeProvider(config.id);
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {isAddingProvider && (
                    <div className="p-3 border rounded bg-muted/20">
                      <div className="space-y-3">
                        <Label>Provider Type</Label>
                        <Select value={newProviderType} onValueChange={(value) => setNewProviderType(value as AIProvider)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="openai">OpenAI</SelectItem>
                            <SelectItem value="anthropic">Anthropic</SelectItem>
                            <SelectItem value="google">Google Gemini</SelectItem>
                            <SelectItem value="ollama">Ollama (Local)</SelectItem>
                            <SelectItem value="lmstudio">LM Studio (Local)</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={addProvider}>Add</Button>
                          <Button size="sm" variant="outline" onClick={() => setIsAddingProvider(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Provider Configuration */}
            <div className="lg:col-span-2 space-y-6">
              {selectedConfig ? (
                <ProviderConfigCard
                  config={selectedConfig}
                  availableModels={availableModels[selectedConfig.id] || []}
                  onUpdate={updateProvider}
                  onRefreshModels={refreshModelsForProvider}
                  isDefault={userPreferences?.defaultProvider === selectedConfig.id}
                  onSetDefault={() => updateUserPreferences({ defaultProvider: selectedConfig.id })}
                />
              ) : (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <SettingsIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Select a provider from the list to configure its settings.</p>
                  </CardContent>
                </Card>
              )}

              {/* User Preferences */}
              <Card>
                <CardHeader>
                  <CardTitle>Chat Preferences</CardTitle>
                  <CardDescription>Customize your chat experience</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="temperature">Temperature</Label>
                      <span className="text-sm text-muted-foreground">
                        {userPreferences?.temperature?.toFixed(1) || "0.7"}
                      </span>
                    </div>
                    <Slider
                      id="temperature"
                      min={0}
                      max={2}
                      step={0.1}
                      value={[userPreferences?.temperature || 0.7]}
                      onValueChange={([value]) => updateUserPreferences({ temperature: value })}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Lower values make responses more focused and deterministic, higher values make them more creative.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="system-prompt">System Prompt</Label>
                    <Textarea
                      id="system-prompt"
                      value={userPreferences?.systemPrompt || ""}
                      onChange={(e) => updateUserPreferences({ systemPrompt: e.target.value })}
                      placeholder="Enter a system prompt to customize the AI's behavior..."
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Appearance */}
              <Card>
                <CardHeader>
                  <CardTitle>Appearance</CardTitle>
                  <CardDescription>Customize the look and feel of Flow Chat</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="font">Font Family</Label>
                    <Select
                      value={userPreferences?.fontFamily || "inter"}
                      onValueChange={(value) => updateUserPreferences({ fontFamily: value as FontFamily })}
                    >
                      <SelectTrigger id="font">
                        <SelectValue placeholder="Select a font" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inter">Inter</SelectItem>
                        <SelectItem value="geist">Geist</SelectItem>
                        <SelectItem value="jetbrains">JetBrains Mono</SelectItem>
                        <SelectItem value="poppins">Poppins</SelectItem>
                        <SelectItem value="roboto">Roboto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="color-code-nodes">Color Code Nodes</Label>
                      <p className="text-sm text-muted-foreground">
                        Color code AI nodes based on the model used for easy identification
                      </p>
                    </div>
                    <Switch
                      id="color-code-nodes"
                      checked={userPreferences?.colorCodeNodes ?? false}
                      onCheckedChange={(checked) => updateUserPreferences({ colorCodeNodes: checked })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Data Management */}
              <Card>
                <CardHeader>
                  <CardTitle>Data Management</CardTitle>
                  <CardDescription>Manage your data and privacy</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button variant="outline" className="flex-1" onClick={exportSettings}>
                      <Download className="mr-2 h-4 w-4" />
                      Export Settings
                    </Button>
                    <Label className="flex-1">
                      <Button variant="outline" className="w-full" asChild>
                        <span>
                          <Upload className="mr-2 h-4 w-4" />
                          Import Settings
                        </span>
                      </Button>
                      <Input
                        type="file"
                        accept=".json"
                        onChange={importSettings}
                        className="hidden"
                      />
                    </Label>
                  </div>
                  <Button variant="destructive" className="w-full" onClick={clearAllData}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear All Chat History
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

interface ProviderConfigCardProps {
  config: ProviderConfig;
  availableModels: ModelInfo[];
  onUpdate: (config: ProviderConfig) => void;
  onRefreshModels: (config: ProviderConfig) => void;
  isDefault: boolean;
  onSetDefault: () => void;
}

function ProviderConfigCard({
  config,
  availableModels,
  onUpdate,
  onRefreshModels,
  isDefault,
  onSetDefault
}: ProviderConfigCardProps) {
  const [formData, setFormData] = useState(config);

  // Reset form data when config changes (e.g., when switching between providers)
  useEffect(() => {
    setFormData(config);
  }, [config]);

  // Clear default model if it's not available in current models
  useEffect(() => {
    if (formData.defaultModel && availableModels.length > 0) {
      const modelExists = availableModels.some(model => model.id === formData.defaultModel);
      if (!modelExists) {
        setFormData(prev => ({ ...prev, defaultModel: undefined }));
      }
    }
  }, [formData.defaultModel, availableModels]);

  const handleSave = () => {
    onUpdate(formData);
  };

  const handleRefreshModels = () => {
    onRefreshModels(config);
  };

  const needsApiKey = !["ollama", "lmstudio"].includes(config.provider);
  const needsBaseUrl = ["ollama", "lmstudio"].includes(config.provider);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Configure {config.name}
          <div className="flex items-center gap-2">
            <div className="flex items-center space-x-2">
              <Switch
                checked={isDefault}
                onCheckedChange={onSetDefault}
              />
              <Label className="text-sm">Default Provider</Label>
            </div>
          </div>
        </CardTitle>
        <CardDescription>
          Configure authentication and settings for {config.name}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Display Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Provider display name"
          />
        </div>

        {needsApiKey && (
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              value={formData.apiKey || ""}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder="Enter your API key"
            />
            <p className="text-xs text-muted-foreground">
              Your API key is stored locally and never shared.
            </p>
          </div>
        )}

        {needsBaseUrl && (
          <div className="space-y-2">
            <Label htmlFor="base-url">Base URL</Label>
            <Input
              id="base-url"
              value={formData.baseUrl || ""}
              onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
              placeholder={config.provider === "ollama" ? "http://localhost:11434" : "http://localhost:1234"}
            />
          </div>
        )}

        {availableModels.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="default-model">Default Model</Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRefreshModels}
                title="Refresh available models"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            <Select
              value={formData.defaultModel || ""}
              onValueChange={(value) => setFormData({ ...formData, defaultModel: value })}
            >
              <SelectTrigger id="default-model">
                <SelectValue placeholder="Select default model" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex flex-col">
                      <span>{model.name}</span>
                      {model.description && (
                        <span className="text-xs text-muted-foreground">{model.description}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Models</Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRefreshModels}
                title="Refresh available models"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            <div className="text-sm text-muted-foreground p-3 border rounded bg-muted/20">
              {needsApiKey && !formData.apiKey
                ? "Configure API key to load available models"
                : needsBaseUrl
                  ? `No models found. Make sure ${config.provider === "ollama" ? "Ollama" : "LM Studio"} is running and accessible.`
                  : "No models available. Click refresh to try again."}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave}>
            Save Configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}