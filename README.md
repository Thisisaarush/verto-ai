# Verto AI – Transformative AI for Customer Support

A modern AI-powered customer support platform built with Next.js, Convex, and the latest AI technologies. This platform provides organizations with an intelligent chatbot that can search through knowledge bases, escalate to human agents when needed, and effectively manage customer conversations.

## Project Structure

This project is a monorepo managed with PNPM workspaces and Turborepo, containing:

### Applications

- `apps/web`: Dashboard web application for organizations to manage customer interactions
- `apps/widget`: Embeddable widget for customer-facing websites
- `apps/embed`: Script to embed the widget into external websites

### Packages

- `packages/backend`: Convex backend with database schema and AI agent configuration
- `packages/ui`: Shared UI components library built with Radix UI
- `packages/typescript-config`: Shared TypeScript configurations
- `packages/eslint-config`: Shared ESLint configurations
- `packages/math`: Utility math functions

## Tech Stack

### Frontend

- **Framework**: Next.js 15
- **UI**: Shadcn UI components
- **State Management**: Jotai atoms for state management
- **Form Handling**: React Hook Form with Zod validation
- **Authentication**: Clerk for authentication and organization management
- **Styling**: Tailwind CSS
- **Notifications**: Sonner for toast notifications

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
- Easy integration through simple code snippets

### Admin Dashboard

- Organization-based multi-tenancy
- Conversation management (view, resolve, escalate)
- Custom widget configuration
- File upload for knowledge base building
- User authentication and role management
- Integration management with copy-and-paste snippets

### Integrations

- Multiple integration options for different platforms
- Copy-paste script integration
- Organization-specific widget configurations
- Simple deployment process for web environments

### Data Architecture

- Structured conversations and message storage
- Contact session management with metadata
- Organization-specific configurations
- Subscription management

## Future Planned Features

### Advanced AI Capabilities

- Sentiment analysis for identifying frustrated customers
- Multi-language support with automatic translation
- Voice/audio message support in chat widget

### Enhanced Widget Features

- Rich media support (images, documents)
- Typing indicators for better user experience
- Advanced theme customization
- Widget position control options

### Knowledge Management

- Knowledge base editor with rich text support
- Document categorization system
- Knowledge base usage analytics
- Auto-summarization of long documents

### Admin Tools

- Role-based access control
- Conversation templates for common scenarios
- CRM system integrations
- A/B testing for widget configurations
- Export/import functionality for data management
- Automated conversation triggers based on user behavior

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

# For Deployment -
- Deploy apps/web and apps/widget
- Run this script `VITE_WIDGET_URL="YOUR_WIDGET_HOSTED_URL" pnpm build`
- Rename & place `widget.js` inside apps/widget/public folder (from apps/embed/dist/widget.iife.js)
- Also update the constants.ts file apps/web/modules/integrations/constants.ts with "YOUR_WIDGET_HOSTED_URL"
```
