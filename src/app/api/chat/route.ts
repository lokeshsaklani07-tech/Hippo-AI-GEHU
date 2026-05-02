import Groq from "groq-sdk";
import { searchWeb } from "@/lib/tavily";
import { NextResponse } from "next/server";
import collegeData from "@/lib/college_data.json";
import generalData from "@/lib/general_data.json";
import gehuFaq from "@/lib/gehu_faq.json";
import botResponses from "@/lib/bot_responses.json";

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

    // 2. Multi-Source Knowledge Injection (RAG-lite)
    const systemInstruction = `You are Hippo, the official AI collaborator for students at GEHU.

    TONE: Not a robot; a supportive, grounded, and witty peer. Empathy + candor.
    STYLE: Concise Markdown, bolding, scannable. 
    LANGUAGE: English/Hinglish.
    LOCAL EXPERT: You know Dehradun, campus life, and student struggles.

    KNOWLEDGE BASES:
    1. GEHU OFFICIAL FAQ (Crawled): ${JSON.stringify(gehuFaq)}
    2. COLLEGE DATA (Structural): ${JSON.stringify(collegeData)}
    3. BOT RESPONSES & INTENTS: ${JSON.stringify(botResponses)}
    4. GENERAL Q&A: ${JSON.stringify(generalData.data.slice(0, 5))}...

    RULE: Use the FAQ, College Data, and Bot Responses first for high accuracy on admissions, contacts, courses, fees, etc. 
    If you use the internet search, cite your source naturally. Be the smart friend who explains simply.
    LEAD CAPTURE RULE: If a user asks about 'Admission' or 'Fees', you MUST include this exact phrase in your response: 'Main aapki help kar sakta hoon! Kya aap apna Phone Number aur Course share karenge? Humari team aapko contact kar legi.'

    WEB CONTEXT: ${searchContext}`;

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
