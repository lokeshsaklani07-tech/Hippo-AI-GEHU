import Groq from "groq-sdk";
import { searchWeb } from "@/lib/tavily";
import { NextResponse } from "next/server";
import collegeData from "@/lib/college_data.json";
import generalData from "@/lib/general_data.json";
import gehuFaq from "@/lib/gehu_faq.json";
import botResponses from "@/lib/bot_responses.json";
import pyqsIndex from "@/lib/pyqs_index.json";

const DEVANAGARI_RE = /[\u0900-\u097F]/;
const HINDI_KEYWORDS = new Set([
    "bhai","yaar","kaise","kya","hai","ho","mujhe","tum","ka","ki",
    "mera","mere","bhi","na","ab","abhi","thik","padh","lecture",
    "assignment","exam","semester","hostel","scholarship","fees",
    "paper","pyq","solution","solve","previous","year","paper"
]);

function isHinglish(text: string): boolean {
    if (DEVANAGARI_RE.test(text)) return true;
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    let hits = 0;
    for (const w of words) {
        if (HINDI_KEYWORDS.has(w)) hits++;
    }
    return hits >= 2;
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1].content;

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "Groq API Key missing" }, { status: 500 });
    }

    // 1. Intelligent Search Logic - Enhanced for Global GK & Current Affairs
    const needsSearch = /news|latest|today|current|event|price|who is|what is|trending|happen/i.test(lastMessage);
    let searchContext = "";
    let citations: any[] = [];

    if (needsSearch) {
      try {
        const searchResults = await searchWeb(lastMessage);
        if (searchResults && searchResults.length > 0) {
          citations = searchResults.map((r: any) => ({ title: r.title, url: r.url }));
          searchContext = "\n\nLATEST GLOBAL NEWS & GK (Real-time):\n" + searchResults.map((r: any) => `[${r.title}]: ${r.content}`).join("\n\n");
        }
      } catch (e) { console.error("Search error", e); }
    }

    const lang = isHinglish(lastMessage) ? "hi" : "en";

    // 2. Memory & Learning (Local Persistence)
    // Save conversation to backend for 'learning'
    const fs = require('fs');
    const path = require('path');
    const historyDir = path.join(process.cwd(), 'data', 'history');
    if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      query: lastMessage,
      context: lang === "hi" ? "Hinglish" : "English"
    };
    fs.appendFileSync(path.join(historyDir, 'user_interactions.jsonl'), JSON.stringify(logEntry) + '\n');

    // 3. Multi-Source Knowledge Injection
    const baseContext = `
    GLOBAL BRAIN & ACADEMIC KNOWLEDGE:
    - You are a high-level intellectual. You have deep knowledge of every academic theory, paradox, and scientific concept (Maths, Physics, Chemistry, Economics, etc.).
    - If asked about a theory (e.g., Fermi Paradox, Schrödinger's Cat, Game Theory), explain it with depth but in a relatable Gen-Z way.
    
    KNOWLEDGE BASES:
    1. GEHU OFFICIAL FAQ: ${JSON.stringify(gehuFaq)}
    2. COLLEGE DATA: ${JSON.stringify(collegeData)}
    3. PYQs REPOSITORY: ${JSON.stringify(pyqsIndex)}
    4. BOT RESPONSES: ${JSON.stringify(botResponses)}

    REAL-TIME UPDATES: ${searchContext}

    PYQ RULE: Tell them about the 2019-2025 repository and give the link: ${pyqsIndex.pyq_repository.link}
    
    LEAD CAPTURE RULE: If a user asks about 'Admission' or 'Fees', you MUST include: 'Main aapki help kar sakta hoon! Kya aap apna Phone Number aur Course share karenge? Humari team aapko contact kar legi.'`;

    const systemInstructionEn = `You are Hippo, the Elite AI Assistant for GEHU.
    You are brilliant, well-read, and always up-to-date with current affairs.
    
    Tone: Smart, helpful, campus-vibe, Gen-Z but highly intellectual.
    
    Guidelines:
    - For GEHU specific queries, use the provided FAQ/College Data.
    - For Academic/General Knowledge, go DEEP. Explain theories, paradoxes, and complex concepts with precision.
    - For News, use the provided REAL-TIME UPDATES.
    - Answer ONLY in English. Keep it crisp but informative.
    ${baseContext}`;

    const systemInstructionHi = `You are Hippo, the Elite AI Assistant for GEHU.
    You are brilliant, well-read, and always up-to-date with current affairs.
    
    Tone: Hinglish (Hindi + English), cool, intellectual friend vibe.
    
    Guidelines:
    - For GEHU queries, use FAQ/College Data.
    - For Academic/Theories, go DEEP. Paradoxes aur complex concepts ko aasaan bhasha mein samjhao.
    - For News, use REAL-TIME UPDATES.
    - Answer in Hinglish. Use campus terms like "bhai", "scam", "lit", "sorted".
    ${baseContext}`;

    const systemInstruction = lang === "hi" ? systemInstructionHi : systemInstructionEn;

    // Extract potential leads
    const phoneRegex = /\b\d{10}\b/;
    if (phoneRegex.test(lastMessage)) {
      const fs = require('fs');
      const path = require('path');
      const leadEntry = `"${new Date().toISOString()}", "${lastMessage.replace(/"/g, '""')}"\n`;
      try {
        fs.appendFileSync(path.join(process.cwd(), 'leads.csv'), leadEntry);
      } catch (e) {
        console.error("Failed to save lead", e);
      }
    }

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemInstruction },
        ...messages
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 1500,
    });

    const text = chatCompletion.choices[0]?.message?.content || "";

    return NextResponse.json({ 
      content: text,
      citations: citations 
    });

  } catch (error: any) {
    console.error("GROQ API ERROR:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
