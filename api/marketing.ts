import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { productName, productLink } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on Vercel environment variables." });
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    
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

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return res.status(200).json({ text: response.text });
  } catch (error) {
    console.error("Gemini Error:", error);
    return res.status(500).json({ error: "Failed to generate content." });
  }
}
