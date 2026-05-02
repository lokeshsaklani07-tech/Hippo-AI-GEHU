import os, re, datetime, requests
from dotenv import load_dotenv
from fastapi import FastAPI, Body
from langchain.prompts import ChatPromptTemplate
from langchain.schema import StrOutputParser
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI
import tavily

load_dotenv()                     # .env → env-vars

# ---------- 1️⃣  कॉन्फ़िग ----------
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY")
GEMINI_KEY    = os.getenv("GEMINI_API_KEY")
TAVILY_KEY    = os.getenv("TAVILY_API_KEY")
OWM_KEY       = os.getenv("OPENWEATHER_API_KEY")

# ---------- 2️⃣  टूल्स ----------
tavily_client = tavily.SearchApi(api_key=TAVILY_KEY)

def get_weather(city: str = "Dehradun"):
    r = requests.get(
        "https://api.openweathermap.org/data/2.5/weather",
        params={"q": city, "appid": OWM_KEY, "units": "metric"},
        timeout=8,
    )
    if r.status_code != 200: return None
    d = r.json()
    desc = d["weather"][0]["description"].capitalize()
    temp = d["main"]["temp"]
    feels = d["main"]["feels_like"]
    hum = d["main"]["humidity"]
    wind = d["wind"]["speed"]
    sr = datetime.datetime.fromtimestamp(d["sys"]["sunrise"]).strftime("%I:%M %p")
    ss = datetime.datetime.fromtimestamp(d["sys"]["sunset"]).strftime("%I:%M %p")
    return f"🌤️ {city} में आज {desc} है, तापमान {temp}°C (feels like {feels}°C). Humidity {hum} %, wind {wind} m/s. सूर्योदय {sr}, सूर्यास्त {ss}."

def search_places(query: str, location: str = "Dehradun, India", k: int = 5):
    resp = tavily_client.search(
        query=f"{query} in {location}",
        search_depth="advanced",
        max_results=k,
        include_answer=True,
        include_domains=["maps","places"]
    )
    return resp

def format_places(r: dict) -> str:
    if not r.get("results"): return "माफ़ करें, अभी कोई जानकारी नहीं मिली।"
    out = []
    for i, it in enumerate(r["results"], 1):
        line = f"{i}. {it.get('title')}"
        if it.get('rating'): line += f" – ⭐{it['rating']}"
        line += f"\n   {it.get('snippet','')}\n   {it.get('url')}"
        out.append(line)
    return "\n\n".join(out)

# ---------- 3️⃣  भाषा-डिटेक्टर ----------
DEV_RE = re.compile(r'[\u0900-\u097F]')
HKEYS = {"bhai","yaar","kaise","kya","hai","ho","mujhe","tum","ab","abhi","thik","padh","lecture"}

def is_hinglish(txt: str) -> bool:
    if DEV_RE.search(txt): return True
    words = re.findall(r"\b\w+\b", txt.lower())
    return sum(w in HKEYS for w in words) >= 2

# ---------- 4️⃣  LLM सेट-अप ----------
# Note: You can switch between Claude and Gemini by passing the respective client to llm_reply
claude = ChatAnthropic(model="claude-3-5-sonnet-20240620", anthropic_api_key=ANTHROPIC_KEY) if ANTHROPIC_KEY else None
gemini = ChatGoogleGenerativeAI(model="gemini-1.5-pro", google_api_key=GEMINI_KEY) if GEMINI_KEY else None

SYSTEM_EN = """You are a Gen-Z student-assistant for Graphic Era Hill University, Dehradun. 
Reply only in English. Keep answers short, friendly and add emojis. 
If you cannot find the info, say so politely."""
SYSTEM_HI = """आप एक Gen-Z छात्र-सहायक हैं Graphic Era Hill University, Dehradun के लिए। 
सिर्फ वही भाषा में जवाब दें जो यूज़र ने इस्तेमाल की (अगर यूज़र हिंग्लिश बोले तो हिंग्लिश)। 
जवाब छोटा, दोस्ताना और इमॉजी के साथ रखें। अगर जानकारी नहीं मिले तो विनम्रता से कहें।"""

prompt = ChatPromptTemplate.from_template("{system}\n{user}")

def llm_reply(user_msg: str, chosen_llm):
    if not chosen_llm:
        return "LLM Client not initialized. Please check your API keys."
        
    chain = prompt | {"system": SYSTEM_EN if not is_hinglish(user_msg) else SYSTEM_HI,
                     "user": user_msg} | chosen_llm | StrOutputParser()
    return chain.invoke({})

# ---------- 5️⃣  रूटर ----------
def route(user_msg: str) -> str:
    # 1️⃣ टूल-कॉल्स
    low = user_msg.lower()
    if any(w in low for w in ["weather","temperature","मौसम","तापमान","धूप"]):
        w = get_weather()
        if w: return w

    if any(w in low for w in ["भोजन","खाना","restaurant","cafe","place","spot","जगह","खाने"]):
        places = search_places(user_msg)
        return format_places(places)

    # 2️⃣ कोई टूल नहीं → LLM (Claude को डिफ़ॉल्ट)
    # Using Gemini as fallback if Claude isn't configured, otherwise use Claude
    chosen_model = claude if claude else gemini
    return llm_reply(user_msg, chosen_model)

# ---------- 6️⃣  FastAPI एन्डपॉइंट ----------
app = FastAPI()

@app.post("/chat")
async def chat_endpoint(message: str = Body(..., embed=True)):
    reply = route(message)
    return {"reply": reply}

if __name__ == "__main__":
    import uvicorn
    print("Starting bot engine on port 8000...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
