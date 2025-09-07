# FlowChat

FlowChat is an experimental chat and flow/canvas application built with Next.js and TypeScript. It provides a node-based chat canvas, provider selection UI, and serverless API routes for interacting with AI models.

Deployed version: https://flowchat-self.vercel.app/

## Quick overview
- Canvas-style chat interface with movable nodes
- Pluggable AI provider integrations
- Provider setup and model listing via serverless routes

## Tech stack
- Next.js (App Router)
- React + TypeScript
- pnpm for package management
- Vercel for deployment

## Requirements
- Node.js 18 or newer
- pnpm (recommended)

## Local development
Install dependencies and run the development server:

```bash
pnpm install
pnpm dev
```

Then open http://localhost:3000 in your browser.

Build for production:

```bash
pnpm build
pnpm start
```

## Deployment

### Cloud AI Providers (Recommended)
For production deployments on Vercel, use cloud-based AI providers:
- **OpenAI**: Add `OPENAI_API_KEY` environment variable
- **Anthropic**: Add `ANTHROPIC_API_KEY` environment variable  
- **Google**: Add `GOOGLE_API_KEY` environment variable

### Local AI Providers (Development Only)
Local providers like LM Studio and Ollama only work in development:
- **LM Studio**: Runs on `http://localhost:1234` by default
- **Ollama**: Runs on `http://localhost:11434` by default

**Important for Local Providers on Deployed Apps:**
To use LM Studio or Ollama with the deployed app, you need to enable CORS:

**LM Studio CORS Setup:**
1. Open LM Studio
2. Go to Settings → Advanced
3. Enable "Allow CORS requests"
4. Set allowed origins to include your deployed app URL

**Ollama CORS Setup:**
Set the OLLAMA_ORIGINS environment variable:
```bash
# Windows (PowerShell)
$env:OLLAMA_ORIGINS = "https://your-app.vercel.app,http://localhost:3000"

# macOS/Linux
export OLLAMA_ORIGINS="https://your-app.vercel.app,http://localhost:3000"
```

Then restart Ollama.

To use local providers in production, you would need to:
1. Deploy them on a publicly accessible server
2. Set environment variables:
   - `LMSTUDIO_BASE_URL=https://your-lmstudio-server.com`
   - `OLLAMA_BASE_URL=https://your-ollama-server.com`

### Environment Variables
Add these to your Vercel deployment:
```
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_API_KEY=your_google_key
LMSTUDIO_BASE_URL=https://your-lmstudio-server.com (optional)
OLLAMA_BASE_URL=https://your-ollama-server.com (optional)
```

## Contributing
Contributions are welcome. Please open issues or pull requests for fixes and features.
