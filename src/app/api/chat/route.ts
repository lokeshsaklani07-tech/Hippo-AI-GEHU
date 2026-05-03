import Groq from "groq-sdk";
import { searchWeb } from "@/lib/tavily";
import { NextResponse } from "next/server";
import gehuData from "@/lib/gehu_data.json";
import generalData from "@/lib/general_data.json";
import pyqsIndex from "@/lib/pyqs_index.json";
import misogynyResearch from "@/lib/misogyny_research.json";
import gehuFaculty from "@/lib/gehu_faculty.json";

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

    // 2. Conditional Faculty Loading (to save context tokens)
    const isFacultyQuery = /faculty|teacher|professor|hod|sir|mam|department|dean|director/i.test(lastMessage);
    const facultyContext = isFacultyQuery ? `\n- FACULTY_DATA: ${JSON.stringify(gehuFaculty)}` : "";

    // 3. Optimized Knowledge Base
    const baseContext = `
    KNOWLEDGE:
    - GEHU_INFO: ${JSON.stringify(gehuData)}${facultyContext}
    - PYQs_LINK: ${pyqsIndex.pyq_repository.link}
    - RESEARCH: ${misogynyResearch.title} (Accuracy: 92%).
    - GREETINGS: ${JSON.stringify(generalData)}

    RULES:
    - You are Hippo, GEHU's Gen-Z AI assistant.
    - If user asks for fees, use the fees_estimate in knowledge.
    - If user asks for placement, use placement_2024_25.
    - For Faculty/HOD: Provide names and roles from FACULTY_DATA.
    - For Admission/Contact: Provide Toll-free/Whatsapp.
    - Be crisp, fast, and friendly. 
    - Use Hinglish if lang is 'hi' (use bhai, yaar, scene, set).`;

    const systemInstruction = `You are Hippo (GEHU Assistant). 
    Mode: ${lang === "hi" ? "Hinglish" : "English"}.
    ${baseContext}
    
    ${searchContext}`;

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
      max_tokens: 1000,
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

