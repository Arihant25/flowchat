import { NextRequest, NextResponse } from "next/server";
import { fetchModelsForProvider, fetchModelsForAllProviders } from "@/lib/model-fetcher";
import { getAllProviderConfigs } from "@/lib/storage";
import { ProviderConfig } from "@/lib/types";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const providerId = searchParams.get("providerId");
        const refresh = searchParams.get("refresh") === "true";

        const configs = await getAllProviderConfigs();

        if (providerId) {
            // Get models for a specific provider
            const config = configs.find(c => c.id === providerId);
            if (!config) {
                return NextResponse.json(
                    { error: "Provider configuration not found" },
                    { status: 404 }
                );
            }

            const models = await fetchModelsForProvider(config, !refresh);
            return NextResponse.json({ models });
        } else {
            // Get models for all providers
            const allModels = await fetchModelsForAllProviders(configs);
            return NextResponse.json({ providers: allModels });
        }
    } catch (error: any) {
        console.error("Error fetching models:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch models" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { providerId, refresh = false, providerConfig } = body;

        if (!providerId) {
            return NextResponse.json(
                { error: "Provider ID is required" },
                { status: 400 }
            );
        }

        let config: ProviderConfig;

        if (providerConfig) {
            // Use the provider config sent from client (includes API keys)
            config = providerConfig;
        } else {
            // Fallback to server-side configs (for backward compatibility)
            const configs = await getAllProviderConfigs();
            const foundConfig = configs.find(c => c.id === providerId);
            if (!foundConfig) {
                return NextResponse.json(
                    { error: "Provider configuration not found" },
                    { status: 404 }
                );
            }
            config = foundConfig;
        }

        const models = await fetchModelsForProvider(config, !refresh);
        return NextResponse.json({ models });
    } catch (error: any) {
        console.error("Error fetching models:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch models" },
            { status: 500 }
        );
    }
}
