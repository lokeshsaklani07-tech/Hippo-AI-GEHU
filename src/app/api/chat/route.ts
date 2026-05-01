import { GoogleGenerativeAI } from "@google/generative-ai";
import { searchWeb } from "@/lib/tavily";
import { NextResponse } from "next/server";
import collegeData from "@/lib/college_data.json";
import generalData from "@/lib/general_data.json";

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1].content;

    console.log("Hippo received message:", lastMessage);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Missing GEMINI_API_KEY");
      return NextResponse.json({ error: "API Key missing" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.8, // Slightly higher for better personality
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
      } catch (e) { console.error("Search error", e); }
    }

    // 2. Simplified Persona for faster response
    const systemInstruction = `You are Hippo, the official AI collaborator for GEHU students. 
    You are a witty, supportive, and grounded peer.
    
    KNOWLEDGE BASE (GEHU):
    ${JSON.stringify(collegeData)}

    KNOWLEDGE BASE (GENERAL):
    (Refer to this only for specific facts, jokes, or tech tips):
    ${JSON.stringify(generalData.data.slice(0, 15))} ... (and 45 more entries)

    TONE: Friendly peer. Use emojis.
    STYLE: Scannable Markdown.
    LANGUAGE: English/Hinglish.
    RULE: Be concise. If the user says "Hi", just be your friendly self!`;

    const prompt = `${systemInstruction}\n\nUser Query: ${lastMessage}${searchContext}`;

    console.log("Calling Gemini API...");
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    console.log("Gemini responded successfully.");

    return NextResponse.json({ 
      content: text,
      citations: citations 
    });

  } catch (error: any) {
    console.error("CRITICAL API ERROR:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
