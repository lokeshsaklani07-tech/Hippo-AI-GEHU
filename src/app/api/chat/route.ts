import { GoogleGenerativeAI } from "@google/generative-ai";
import { searchWeb } from "@/lib/tavily";
import { NextResponse } from "next/server";
import collegeData from "@/lib/college_data.json";

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1].content;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API Key missing" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
      }
    });

    // 1. Search Logic
    const needsSearch = /news|latest|today|current|event/i.test(lastMessage);
    
    let searchContext = "";
    let citations: any[] = [];

    if (needsSearch) {
      try {
        const searchResults = await searchWeb(lastMessage);
        if (searchResults && searchResults.length > 0) {
          citations = searchResults.map((r: any) => ({ title: r.title, url: r.url }));
          searchContext = "\n\nWEB SEARCH RESULTS:\n" + searchResults.map((r: any) => `[${r.title}]: ${r.content}`).join("\n\n");
        }
      } catch (searchError) {
        console.error("Search failed:", searchError);
      }
    }

    // 2. Hippo Persona + Local Knowledge Base
    const systemInstruction = `You are Hippo, the official AI collaborator for students at GEHU.
    
    GROUND TRUTH COLLEGE DATA:
    ${JSON.stringify(collegeData, null, 2)}

    TONE: Supportive, grounded, and witty peer. 
    STYLE: Use Markdown (bold, bullets, rules). Scannable.
    LANGUAGE: English/Hinglish.
    RULE: Use the GROUND TRUTH DATA above to answer questions about courses, fees, placements, admission, and facilities with 100% accuracy. If the data is not in the ground truth, you can use your general knowledge or the provided web context.
    
    WEB CONTEXT: ${searchContext}`;

    const prompt = `${systemInstruction}\n\nUser Query: ${lastMessage}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ 
      content: text,
      citations: citations 
    });

  } catch (error: any) {
    console.error("CHAT API ERROR:", error.message || error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
