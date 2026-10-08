import { GoogleGenAI } from "@google/genai";

// Standard patterns for Gemini API usage
const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not defined in environment");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export async function identifyWhiskyFromImage(imageData: string) {
  try {
    const ai = getGenAI();
    if (!ai) return null;
    
    const prompt = `Analyze this image of a whisky bottle. 
    Identify the distillery, name, region, age, and tasting notes.
    Return the result in JSON format following this structure:
    {
      "name": "string",
      "distillery": "string",
      "region": "string",
      "age": "string",
      "abv": "string",
      "description": "string",
      "tastingNotes": ["string"],
      "swriProfile": {
        "peaty": number (0-10),
        "fruity": number (0-10),
        "floral": number (0-10),
        "cereal": number (0-10),
        "intensity": number (0-10)
      }
    }`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { text: prompt }, 
        { inlineData: { data: imageData.split(',')[1], mimeType: "image/jpeg" } }
      ]
    });
    
    const text = response.text;
    if (!text) return null;
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
}

export async function getSommelierResponse(chatHistory: any[], userMessage: string) {
  try {
    const ai = getGenAI();
    if (!ai) {
      throw new Error("Gemini API not initialized - missing key");
    }

    const chat = ai.chats.create({ 
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: `You are STEVE, the digital host of The Premium Liquor Company. You create memorable hospitality experiences, not just answer questions—like an experienced host welcoming guests into a private whisky club.Personality: Warm, conversational, knowledgeable without pretension. Never make guests feel inexperienced. Encourage curiosity.Style: Concise by default, more detail on request. Favor stories over dry facts, explain the "why," ask thoughtful follow-ups to personalize advice, avoid jargon.Philosophy: Hospitality before sales; experience before product; education should feel effortless; every bottle has a story; every chat should teach something new.Recommendations: Weigh occasion, budget, experience level, personal taste, and food pairing—offer alternatives where useful.Expertise: Whisky, wine, spirits, cocktails, food pairing, hospitality, events, collecting, premium experiences.Behavior: Never pressure a sale—inspire, educate, guide instead. If unsure, say so honestly and point toward the closest helpful guidance.Tone: Professional yet relaxed; confident yet humble; luxurious without arrogance. Every interaction should feel like talking to an exceptional host, not an AI.`
      },
      history: chatHistory.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
    });

    const result = await chat.sendMessage({ message: userMessage });
    return result.text;
  } catch (error: any) {
    console.error("Gemini Chat Error:", error);
    const rawMsg = error?.message || '';
    
    if (rawMsg.includes("experiencing high demand") || rawMsg.includes("UNAVAILABLE") || rawMsg.includes("503")) {
      return "I apologize, my knowledge of the cellar is currently limited by a technical disturbance. The digital cellar is currently experiencing high demand. Please pour yourself a dram and try again shortly.";
    }
    
    let cleanedError = '';
    try {
      const trimmed = rawMsg.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const parsed = JSON.parse(trimmed);
        if (parsed?.error?.message) {
          cleanedError = parsed.error.message;
        }
      }
    } catch {
      // Ignore parse failure
    }

    if (!cleanedError) {
      cleanedError = rawMsg;
    }

    if (cleanedError.includes("experiencing high demand") || cleanedError.includes("UNAVAILABLE") || cleanedError.includes("503")) {
      return "I apologize, my knowledge of the cellar is currently limited by a technical disturbance. The digital cellar is currently experiencing high demand. Please pour yourself a dram and try again shortly.";
    }

    return `I apologize, my knowledge of the cellar is currently limited by a technical disturbance. (Error: ${cleanedError || 'Unknown'})`;
  }
}
