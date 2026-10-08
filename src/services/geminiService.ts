import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function identifyWhisky(base64Image: string, mimeType: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            data: base64Image.split(',')[1] || base64Image,
            mimeType: mimeType
          }
        },
        {
          text: "Identify this bottle. It could be either a whisky or a wine. First determine which category it is ('whisky' or 'wine'). Provide the winery/distillery name as the distillery, specific bottle name/expression, vintage/age statement (if any) as age, region, and detailed flavour profile. Also estimate its character mapping values (on a scale of 1.0 to 10.0) under the swriProfile object using these exact keys:\n- peaty: Peaty rating for whisky (1-10) OR Sweetness/Dryness rating for wine (1-10)\n- fruity: Fruity rating for whisky (1-10) OR Fruitiness rating for wine (1-10)\n- floral: Floral rating for whisky (1-10) OR Acidity rating for wine (1-10)\n- cereal: Cereal rating for whisky (1-10) OR Tannins rating for wine (1-10)\n- intensity: Intensity rating for whisky (1-10) OR Body rating for wine (1-10)\n\nEnsure swriProfile and the root object have a category field matching either 'whisky' or 'wine'. Return the data in JSON format."
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, description: "Either 'whisky' or 'wine'" },
            distillery: { type: Type.STRING, description: "Distillery or Winery/Producer name" },
            name: { type: Type.STRING, description: "Bottle name/expression" },
            age: { type: Type.STRING, description: "Age statement or Wine Vintage (e.g. 2019, 12y, NAS)" },
            region: { type: Type.STRING },
            abv: { type: Type.STRING },
            description: { type: Type.STRING },
            tastingNotes: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of 4-5 core tasting notes"
            },
            swriProfile: {
              type: Type.OBJECT,
              properties: {
                peaty: { type: Type.NUMBER, description: "Whisky peaty level (1-10) or Wine Sweetness level (1-10)" },
                fruity: { type: Type.NUMBER, description: "Whisky fruity level (1-10) or Wine Fruitiness level (1-10)" },
                floral: { type: Type.NUMBER, description: "Whisky floral level (1-10) or Wine Acidity level (1-10)" },
                cereal: { type: Type.NUMBER, description: "Whisky cereal level (1-10) or Wine Tannin level (1-10)" },
                intensity: { type: Type.NUMBER, description: "Whisky intensity level (1-10) or Wine Body level (1-10)" },
                category: { type: Type.STRING, description: "Must be either 'whisky' or 'wine'" }
              },
              required: ["peaty", "fruity", "floral", "cereal", "intensity", "category"]
            }
          },
          required: ["name", "distillery", "swriProfile", "category"]
        }
      }
    });

    const jsonStr = response.text;
    if (!jsonStr) throw new Error("No response from AI");
    
    const parsed = JSON.parse(jsonStr);
    // Backward compatibility normalization: if response missed top category, resolve from swriProfile
    if (!parsed.category && parsed.swriProfile?.category) {
      parsed.category = parsed.swriProfile.category;
    }
    if (parsed.category && parsed.swriProfile && !parsed.swriProfile.category) {
      parsed.swriProfile.category = parsed.category;
    }
    return parsed;
  } catch (error) {
    console.error("Gemini identityWhisky error:", error);
    throw error;
  }
}
