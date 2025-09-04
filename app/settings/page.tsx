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
import { Download, Upload, Trash2 } from "lucide-react";

type LLMProvider = "openai" | "anthropic" | "google" | "ollama" | "lm-studio";
type FontFamily = "inter" | "geist" | "jetbrains" | "poppins" | "roboto";

export default function Settings() {
  const [provider, setProvider] = useState<LLMProvider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState([0.7]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [fontFamily, setFontFamily] = useState<FontFamily>("inter");

  useEffect(() => {
    document.documentElement.style.setProperty("--font-family", `var(--font-${fontFamily})`);
    document.body.className = document.body.className.replace(
      /font-\w+/g,
      `font-${fontFamily === "jetbrains" ? "mono" : "sans"}`
    );
  }, [fontFamily]);

  const exportSettings = () => {
    const settings = {
      provider,
      apiKey,
      temperature: temperature[0],
      systemPrompt,
      fontFamily,
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
          if (settings.provider) setProvider(settings.provider);
          if (settings.apiKey) setApiKey(settings.apiKey);
          if (settings.temperature !== undefined) setTemperature([settings.temperature]);
          if (settings.systemPrompt) setSystemPrompt(settings.systemPrompt);
          if (settings.fontFamily) setFontFamily(settings.fontFamily);
        } catch (error) {
          console.error("Failed to import settings:", error);
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

  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-background pt-20">
        <div className="container mx-auto px-6 py-8 max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground mt-2">Manage your Flow Chat preferences and configuration</p>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>LLM Provider</CardTitle>
                <CardDescription>Configure your AI model provider and authentication</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider</Label>
                  <Select value={provider} onValueChange={(value) => setProvider(value as LLMProvider)}>
                    <SelectTrigger id="provider">
                      <SelectValue placeholder="Select a provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                      <SelectItem value="ollama">Ollama (Local)</SelectItem>
                      <SelectItem value="lm-studio">LM Studio (Local)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {provider !== "ollama" && provider !== "lm-studio" && (
                  <div className="space-y-2">
                    <Label htmlFor="api-key">API Key</Label>
                    <Input
                      id="api-key"
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your API key"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Chat Preferences</CardTitle>
                <CardDescription>Customize your chat experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="temperature">Temperature</Label>
                    <span className="text-sm text-muted-foreground">{temperature[0].toFixed(1)}</span>
                  </div>
                  <Slider
                    id="temperature"
                    min={0}
                    max={2}
                    step={0.1}
                    value={temperature}
                    onValueChange={setTemperature}
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
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Enter a system prompt to customize the AI's behavior..."
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize the look and feel of Flow Chat</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="font">Font Family</Label>
                  <Select value={fontFamily} onValueChange={(value) => setFontFamily(value as FontFamily)}>
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
              </CardContent>
            </Card>

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
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button variant="outline" className="flex-1">
                    <Download className="mr-2 h-4 w-4" />
                    Export All Data
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Upload className="mr-2 h-4 w-4" />
                    Import All Data
                  </Button>
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
    </>
  );
}