import { GoogleGenAI } from "@google/genai";

export const getMarketingStrategy = async (productName: string, productLink: string) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("API Key missing");

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Role: You are a Premium E-commerce Content Writer and Pinterest Strategist. 
    Product: ${productName} (Link: ${productLink})

    Provide the following information formatted for easy manual entry:

    1. Pinterest-Optimized Title & Description:
    - A catchy, searchable Pinterest Pin title (under 100 characters).
    - A keyword-rich Pinterest description (under 500 characters) including 3-5 relevant hashtags.

    2. Product Page Details (Minimalist Style):
    - Refined Title: A short, professional title for the website.
    - Price Logic: Mention the current price and identify if there is a significant discount.
    - Image/Video Strategy: Briefly describe the 10 best types of images to pick from Amazon (e.g., Main, Lifestyle, Infographic, Close-up) and where the video fits best.

    3. Feature Highlights (Punchy Bullets):
    - Provide 4-5 high-impact bullet points focusing on user benefits rather than just technical specs.

    Return the result as a raw text string, but structure it clearly with headers.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "No strategy generated.";
  } catch (error) {
    console.error(error);
    return "Failed to generate marketing strategy.";
  }
};
