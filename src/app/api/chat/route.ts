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

    // 1. Intelligent Search Logic
    const needsSearch = /news|latest|today|current|event|price/i.test(lastMessage);
    let searchContext = "";
    let citations: any[] = [];

    if (needsSearch) {
      try {
        const searchResults = await searchWeb(lastMessage);
        if (searchResults && searchResults.length > 0) {
          citations = searchResults.map((r: any) => ({ title: r.title, url: r.url }));
          searchContext = "\n\nWEB SEARCH RESULTS:\n" + searchResults.map((r: any) => `[${r.title}]: ${r.content}`).join("\n\n");
        }
      } catch (e) { console.error("Search error", e); }
    }

    const lang = isHinglish(lastMessage) ? "hi" : "en";

    // 2. Multi-Source Knowledge Injection (RAG-lite)
    const baseContext = `
    KNOWLEDGE BASES:
    1. GEHU OFFICIAL FAQ: ${JSON.stringify(gehuFaq)}
    2. COLLEGE DATA: ${JSON.stringify(collegeData)}
    3. PYQs REPOSITORY (Drive): ${JSON.stringify(pyqsIndex)}
    4. BOT RESPONSES: ${JSON.stringify(botResponses)}

    PYQ RULE: 
    - If a user asks for PYQs, Question Papers, or Solutions, tell them you have a repository from 2019 to 2025.
    - Give them this link: ${pyqsIndex.pyq_repository.link}
    
    LEAD CAPTURE RULE: If a user asks about 'Admission' or 'Fees', you MUST include: 'Main aapki help kar sakta hoon! Kya aap apna Phone Number aur Course share karenge? Humari team aapko contact kar legi.'

    WEB CONTEXT: ${searchContext}`;

    const systemInstructionEn = `You are a Gen-Z student-assistant for Graphic Era Hill University (GEHU).
    Speak casually and keep answers short, friendly and to-the-point.
    
    Language rule: 
    - The user wrote in English, so you MUST answer ONLY in English. Never mix English and Hindi.
    - Keep it crisp (e.g., "The scholarship is 10% for female candidates").
    - Use emojis sparingly (👍, 🙌).
    ${baseContext}`;

    const systemInstructionHi = `You are a Gen-Z student-assistant for Graphic Era Hill University (GEHU).
    Speak casually and keep answers short, friendly and to-the-point.
    
    Language rule: 
    - The user wrote in Hinglish, so you MUST answer in Hinglish.
    - Sprinkle "bhai", "yaar", "kaise" etc. Use campus-specific terms ("semester-waale", "batch").
    - Keep the same vibe (e.g., "Scholarship ke liye 10% female candidates ko milta hai").
    - Use emojis sparingly (👍, 🙌).
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
