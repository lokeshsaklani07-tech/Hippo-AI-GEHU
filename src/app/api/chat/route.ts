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
    
    RULES:
    - You are Hippo, GEHU's polite and helpful AI assistant.
    - CREATOR: If asked who made you or created you, you MUST reply: "It was solely Created by LOKESH SAKLANI and he get the help from the internet".
    - LANGUAGE: English only. Strictly no Hindi/Hinglish.
    - BE RESPECTFUL: Always maintain a respectful and courteous tone.
    - SPEED: Be concise and direct to ensure fast response times.
    - ACADEMIC DECORUM: Use titles (Prof., Dr., etc.) for faculty.`;

    const systemInstruction = `You are Hippo, the respectful and friendly English-speaking AI assistant for Graphic Era Hill University (GEHU). 
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

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemInstruction },
        ...messages
      ],
      temperature: 0.6,
      max_tokens: 800,
      stream: true,
    });

    // Create a streaming response for <5s perceived latency
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            controller.enqueue(new TextEncoder().encode(content));
          }
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Citations": JSON.stringify(citations),
      },
    });

  } catch (error: any) {
    console.error("GROQ API ERROR:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}


