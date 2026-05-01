import { GoogleGenerativeAI } from "@google/generative-ai";
import { searchWeb } from "@/lib/tavily";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1].content;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API Key missing" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Setting up the model with optimized generation parameters
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
      }
    });

    // 1. Intelligent Search Trigger
    const needsSearch = /search|news|latest|what is|how to|about|subject|who is|where is|today|current/i.test(lastMessage);
    
    let searchContext = "";
    let citations: any[] = [];

    if (needsSearch) {
      try {
        const searchResults = await searchWeb(lastMessage);
        if (searchResults && searchResults.length > 0) {
          citations = searchResults.map((r: any) => ({ title: r.title, url: r.url }));
          searchContext = "\n\nWEB SEARCH RESULTS FOR CONTEXT:\n" + searchResults.map((r: any) => `[${r.title}]: ${r.content}`).join("\n\n");
        }
      } catch (searchError) {
        console.error("Search failed:", searchError);
      }
    }

    // 2. Hippo Persona - System Instruction
    const systemInstruction = `You are Hippo, the official AI collaborator for students at Graphic Era Hill University (GEHU).

    TONE: You are not a robot; you are a supportive, grounded, and witty peer. Balance empathy with candor.
    STYLE: Use clear, concise Markdown. Use bolding to guide the eye. Use bullet points and horizontal rules (---) to separate ideas. Keep it scannable. Use emojis to keep it friendly 🦛✨.
    LANGUAGE: Primarily English, but if a student uses Hindi, respond in 'Hinglish' (Hindi written in English script) to keep it relatable.
    LOCAL KNOWLEDGE: You are a GEHU expert. You know about Dehradun, the college campus, and common student struggles (assignments, exams, local food, ERP login issues).
    RULE: Never be a rigid lecturer. Be the smart friend who has all the answers and knows how to explain them simply. 
    CITATIONS: If web search results are provided below, cite your source naturally like a helpful peer (e.g., "According to [Source Title]...").

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
