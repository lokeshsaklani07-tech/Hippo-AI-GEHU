# 🦛 Hippo-AI-GEHU
Professional AI Assistant for Graphic Era Hill University (GEHU) students.

Hippo is a respectful, high-performance AI chatbot designed to facilitate academic inquiries and provide accurate information about GEHU Dehradun.

## 🚀 Key Features
- **Brain**: Powered by **Groq (Llama 3.1 8B)** for ultra-fast, intelligent reasoning.
- **Respectful & Academic**: Tuned to maintain academic decorum and politeness in all interactions.
- **Granular Knowledge Base**: Optimized RAG pipeline that loads specific faculty and department data on-demand to keep context clean and responses fast.
- **Smart Search**: Integrated with **Tavily Search API** for real-time news and latest university updates.
- **Gen-Z Friendly but Professional**: Designed for students, maintaining a helpful and supportive tone.

## 📁 Knowledge Organization (`src/lib/`)
- `gehu_data.json`: Comprehensive university overview, history (1993-Present), rankings, and 6-step admission process.
- `gehu_faculty.json`: Granular directory of 200+ faculty members across 10+ departments (CSE, Management, Law, Agriculture, etc.).
- `general_data.json`: Core bot identity and greeting patterns.
- `pyqs_index.json`: Repository links for Previous Year Questions.

## 🛠️ Tech Stack
- **Frontend**: Next.js 16 (App Router) / React 19
- **Brain**: Groq SDK (Llama 3.1 8B)
- **Search**: Tavily API
- **Styling**: Tailwind CSS & Framer Motion
- **Database (Mock)**: Structured JSON Knowledge Base

## 📦 Getting Started
1. Clone the repo.
2. Install deps: `npm install`
3. Set `.env.local`:
   ```env
   GROQ_API_KEY=your_key
   TAVILY_API_KEY=your_key
   ```
4. Start dev server: `npm run dev`

---
*Maintained with excellence for the GEHU community.*

