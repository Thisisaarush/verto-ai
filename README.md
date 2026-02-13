# Verto AI – AI Customer Support SaaS

Verto AI is a multi-tenant AI-powered customer support platform that enables
businesses to deploy an intelligent chatbot trained on their own knowledge base,
manage conversations, and escalate complex issues to human agents.

Built for SaaS products, e-commerce stores, and service businesses.

---

## 🚀 Features

- AI-powered chat (default google gemini)
- Bring your own API Key (ChatGPT, Claude)
- Knowledge base ingestion (web scraping, documents)
- Context-aware conversations (RAG)
- Automatic human escalation (Convex Agent)
- Embeddable website chat widget
- Organization-based multi-tenancy (Clerk)
- Admin dashboard for managing conversations, knowledge base, etc.
- Customizable widget appearance
- Session persistence (Convex DB)
- File Upload (Convex File Storage)
- Real-Time Typing Indicators
- Conversation Analytics Dashboard

## Future Scope

- Voice & Video Chat Integration: Enable real-time voice and video support in the widget.
- AI Agent Training UI: Visual interface for admins to train and fine-tune AI responses.
- Advanced Analytics: Deeper insights with custom reports and predictive analytics.

---

## 🧱 Tech Stack

Frontend:

- Next.js 15
- Tailwind CSS
- Shadcn UI
- React Hook Form + Zod
- Jotai

Backend:

- Convex (DB + serverless)
- Convex RAG
- Convex Agent
- Google Gemini (AI SDK)

Auth:

- Clerk

Monitoring:

- Sentry

---

## 🏗 Architecture

Monorepo (PNPM + Turborepo)

apps/

- web → Admin Dashboard
- widget → Customer Chat Widget
- embed → Script loader

packages/

- backend → Convex schema & AI logic
- ui → Shared components
- typescript-config
- eslint-config

---

## 🔁 How It Works

1. Admin uploads documents
2. Documents converted to embeddings
3. User asks question in widget
4. AI searches knowledge base
5. AI generates response
6. Escalate to human if needed

---

## 🌐 Live Demo

<https://verto-ai-web.vercel.app/>

---

## ⚙️ Local Setup

Node 20+

pnpm install  
pnpm dev

---

## 📌 Use Case

This project is designed as a reusable starter kit to build:

- AI customer support systems
- Internal AI assistants
- AI chatbots for websites

---

## 👤 Author

Aarush Tanwar  
<https://aaruush.vercel.app/>  
<https://github.com/Thisisaarush>
