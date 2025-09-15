# Verto AI – Transformative AI for Customer Support

A modern AI-powered customer support platform built with Next.js, Convex, and the latest AI technologies. This platform provides organizations with an intelligent chatbot that can search through knowledge bases, escalate to human agents when needed, and effectively manage customer conversations.

## Project Structure

This project is a monorepo managed with PNPM workspaces and Turborepo, containing:

### Applications

- `apps/web`: Dashboard web application for organizations to manage customer interactions
- `apps/widget`: Embeddable widget for customer-facing websites

### Packages

- `packages/backend`: Convex backend with database schema and AI agent configuration
- `packages/ui`: Shared UI components library built with Radix UI
- `packages/math`: Utility math functions
- `packages/typescript-config`: Shared TypeScript configurations
- `packages/eslint-config`: Shared ESLint configurations

## Tech Stack

### Frontend

- **Framework**: Next.js 15.4
- **UI**: Shadcn UI components
- **State Management**: Jotai atoms for state management
- **Form Handling**: React Hook Form with Zod validation
- **Authentication**: Clerk for authentication and organization management
- **Styling**: Tailwind CSS

### Backend

- **Database & Backend**: Convex for real-time database and serverless functions
- **AI Integration**: Google Gemini 2.5 via AI SDK
- **RAG Support**: Convex RAG for knowledge retrieval
- **Agent Framework**: Convex Agent for structured conversation management
- **Error Monitoring**: Sentry for error tracking and performance monitoring

## Key Features

### AI-Powered Support

- Intelligent support agent built on Google Gemini 2.5
- Knowledge base search for accurate responses
- Automatic escalation to human agents when needed
- Context-aware conversations

### Customer Widget

- Embeddable chat widget for websites
- Customizable greetings and suggested questions
- Session management for persistent conversations
- Responsive design for all devices

### Admin Dashboard

- Organization-based multi-tenancy
- Conversation management (view, resolve, escalate)
- Custom widget configuration
- File upload for knowledge base building
- User authentication and role management

### Data Architecture

- Structured conversations and message storage
- Contact session management with metadata
- Organization-specific configurations
- Subscription management

## Development

### Requirements

- Node.js 20 or higher
- PNPM 10.4.1 or higher

### Setup

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.local.example .env.local

# Run development servers
turbo dev
```

The web dashboard will be available at `http://localhost:3000` and the widget at `http://localhost:3001`.
