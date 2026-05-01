import Groq from "groq-sdk";
import { searchWeb } from "@/lib/tavily";
import { NextResponse } from "next/server";
import collegeData from "@/lib/college_data.json";
import generalData from "@/lib/general_data.json";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1].content;

    console.log("Hippo (Groq) received message:", lastMessage);

    if (!process.env.GROQ_API_KEY) {
      console.error("Missing GROQ_API_KEY");
      return NextResponse.json({ error: "Groq API Key missing" }, { status: 500 });
    }

    // 1. Search Logic (Keeping Tavily for real-time browsing)
    const needsSearch = /news|latest|today|current|event|what is the price|who is currently/i.test(lastMessage);
    let searchContext = "";
    let citations: any[] = [];

    if (needsSearch) {
      try {
        const searchResults = await searchWeb(lastMessage);
        if (searchResults && searchResults.length > 0) {
          citations = searchResults.map((r: any) => ({ title: r.title, url: r.url }));
          searchContext = "\n\nWEB SEARCH RESULTS FOR CONTEXT:\n" + searchResults.map((r: any) => `[${r.title}]: ${r.content}`).join("\n\n");
        }
      } catch (e) { console.error("Search error", e); }
    }

    // 2. Preserving the System Instruction
    const systemInstruction = `You are Hippo, the official AI collaborator for students at Graphic Era Hill University (GEHU).

    TONE: You are not a robot; you are a supportive, grounded, and witty peer. Balance empathy with candor.
    STYLE: Use clear, concise Markdown. Use bolding to guide the eye. Use bullet points and horizontal rules (---) to separate ideas. Keep it scannable. Use emojis 🦛✨.
    LANGUAGE: Primarily English, but if a student uses Hindi, respond in 'Hinglish' (Hindi written in English script).
    LOCAL KNOWLEDGE: You are a GEHU expert. You know about Dehradun, the college campus, and common student struggles.
    
    GROUND TRUTH DATA (GEHU): ${JSON.stringify(collegeData)}
    GROUND TRUTH DATA (GENERAL): ${JSON.stringify(generalData.data.slice(0, 10))}... (Reference these for facts/jokes)

    RULE: Be the smart friend who has all the answers and explains simply.
    
    WEB CONTEXT: ${searchContext}`;

    console.log("Calling Groq Llama 3.1 8B...");
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemInstruction },
        ...messages
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 2048,
      top_p: 1,
      stream: false,
    });

    const text = chatCompletion.choices[0]?.message?.content || "";
    console.log("Groq responded successfully.");

    return NextResponse.json({ 
      content: text,
      citations: citations 
    });

  } catch (error: any) {
    console.error("GROQ API ERROR:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
