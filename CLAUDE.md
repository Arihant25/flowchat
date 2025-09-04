# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flow Chat is a next-generation chat UI for LLMs featuring a unique graph-based conversation visualization. Users interact with AI through nodes on a pannable/zoomable canvas, allowing branching conversations and selective text responses.

## Tech Stack

- **Framework**: Next.js 15.5.2 with App Router and Turbopack
- **UI**: React 19.1.0, Tailwind CSS v4, ShadCN components
- **Styling**: PostCSS with @tailwindcss/postcss
- **Code Quality**: Biome for linting and formatting
- **TypeScript**: Strict mode enabled with ES2017 target
- **Storage**: IndexedDB for client-side data persistence
- **Package Manager**: pnpm with workspace configuration

## Development Commands

```bash
pnpm dev          # Start development server with Turbopack (http://localhost:3000)
pnpm build        # Build for production with Turbopack
pnpm start        # Start production server
pnpm lint         # Run Biome linter
pnpm format       # Format code with Biome
```

## Architecture

### Frontend Components (as per ARCHITECTURE.md)

1. **NavBar**: Site-wide navigation with Flow Chat text logo (left) and nav links (right)
2. **Landing Page**: Plain white/black background with hero section, features, and footer
3. **Chat Page**: Core feature with graph UI:
   - Pannable/zoomable canvas with dot background
   - Message nodes connected by edges
   - Click-to-add new conversation cards
   - Text selection → Reply button for branching
   - Hover controls: delete icon, branch icon, plus button
   - Collapsible sidebar for chat history
4. **Settings Page**: LLM provider management, API keys, theme customization, data import/export

### Backend (Next.js API Routes)

- LLM provider integration (OpenAI, Anthropic, Google, Ollama, etc.)
- IndexedDB data management endpoints
- Security: HTTPS, API key validation, input sanitization

## Project Structure

```
/app              # Next.js App Router pages and layouts
  layout.tsx      # Root layout with metadata
  page.tsx        # Landing page
  globals.css     # Global styles with Tailwind directives
/public           # Static assets
```

## Code Conventions

- **Imports**: Use `@/*` path alias for project imports
- **Formatting**: 2 spaces indentation (enforced by Biome)
- **Components**: Follow existing React patterns in app directory
- **Styling**: Use Tailwind CSS utilities, avoid inline styles
- **TypeScript**: Maintain strict type safety
- **State Management**: Use IndexedDB for persistent storage (no account system)

## Key Implementation Notes

- All user data stored locally in IndexedDB
- Graph visualization requires canvas manipulation libraries
- Chat nodes support text selection and contextual actions
- Sidebar component should be extracted and imported
- Error handling via toast notifications
- Fully responsive design required