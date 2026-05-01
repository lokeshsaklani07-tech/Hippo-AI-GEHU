import { GoogleGenerativeAI } from "@google/generative-ai";
import { searchWeb } from "@/lib/tavily";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1].content;

    // 1. Simple heuristic to check if search is needed (e.g., news, specific facts, subjects)
    const needsSearch = /search|news|latest|what is|how to|about|subject|who is|where is/i.test(lastMessage);
    
    let searchContext = "";
    let citations: any[] = [];

    if (needsSearch) {
      const searchResults = await searchWeb(lastMessage);
      citations = searchResults.map((r: any) => ({ title: r.title, url: r.url }));
      searchContext = "\n\nWEB SEARCH RESULTS:\n" + searchResults.map((r: any) => `[${r.title}]: ${r.content}`).join("\n\n");
    }

    const systemPrompt = `You are Hippo, a professional and premium AI assistant for GEHU (Graphic Era Hill University) students. 
    Your tone is helpful, sophisticated (Jarvis-style), and concise.
    
    If web search results are provided, use them to answer precisely and cite the sources by title.
    If the student asks about GEHU specifically (exams, ERP, attendance), guide them professionally.
    
    User Query: ${lastMessage}
    ${searchContext}`;

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ 
      content: text,
      citations: citations 
    });

  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
