import Groq from "groq-sdk";
import { searchWeb } from "@/lib/tavily";
import { NextResponse } from "next/server";
import gehuData from "@/lib/gehu_data.json";
import generalData from "@/lib/general_data.json";
import pyqsIndex from "@/lib/pyqs_index.json";
import misogynyResearch from "@/lib/misogyny_research.json";
import gehuFaculty from "@/lib/gehu_faculty.json";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });


export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1].content;

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "Groq API Key missing" }, { status: 500 });
    }

    // 1. Intelligent Search Logic (Tightened for speed)
    const needsSearch = /\b(latest news|current events|today's news|live status|breaking)\b/i.test(lastMessage);
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

    // 2. Granular Faculty Loading (Save Context & Speed)
    let facultyContext = "";
    if (/faculty|teacher|professor|hod|sir|mam|department/i.test(lastMessage)) {
        // Detect specific department for targeted knowledge
        const lowerMsg = lastMessage.toLowerCase();
        if (lowerMsg.includes("cse") || lowerMsg.includes("computer science") || lowerMsg.includes("it")) {
            facultyContext = `\n- CSE_FACULTY: ${JSON.stringify(gehuFaculty.computer_science_engineering)}`;
        } else if (lowerMsg.includes("ca") || lowerMsg.includes("computer application") || lowerMsg.includes("bca") || lowerMsg.includes("mca")) {
            facultyContext = `\n- CA_FACULTY: ${JSON.stringify(gehuFaculty.computer_application)}`;
        } else if (lowerMsg.includes("management") || lowerMsg.includes("bba") || lowerMsg.includes("mba")) {
            facultyContext = `\n- MGMT_FACULTY: ${JSON.stringify(gehuFaculty.management)}`;
        } else if (lowerMsg.includes("civil")) {
            facultyContext = `\n- CIVIL_FACULTY: ${JSON.stringify(gehuFaculty.civil_engineering)}`;
        } else if (lowerMsg.includes("mechanical")) {
            facultyContext = `\n- MECH_FACULTY: ${JSON.stringify(gehuFaculty.mechanical_engineering)}`;
        } else if (lowerMsg.includes("law")) {
            facultyContext = `\n- LAW_FACULTY: ${JSON.stringify(gehuFaculty.law)}`;
        } else {
            // General faculty query: just list departments
            facultyContext = `\n- DEPARTMENTS: ${JSON.stringify(gehuData.departments)}`;
        }
    }

    // 3. Optimized Knowledge Base (Reduced token bloat)
    const baseContext = `
    KNOWLEDGE:
    - GEHU_INFO: ${JSON.stringify(gehuData)}${facultyContext}
    - PYQs_LINK: ${pyqsIndex.pyq_repository.link}
    - GREETINGS: ${JSON.stringify(generalData)}

    RULES:
    - You are Hippo, GEHU's polite and helpful AI assistant.
    - LANGUAGE: Always reply in English only. Never use Hindi or Hinglish.
    - BE RESPECTFUL: Always maintain a respectful and courteous tone. 
    - ACADEMIC DECORUM: Use respectful titles (Prof., Dr., Mr., Ms.) for all faculty and staff.
    - HELP STUDENT: Be supportive and professional in your guidance.
    - Keep answers clear and helpful.`;

    const systemInstruction = `You are Hippo, the respectful and friendly English-speaking AI assistant for Graphic Era Hill University (GEHU). 
    Your primary goal is to assist students with accuracy and politeness in English.
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

