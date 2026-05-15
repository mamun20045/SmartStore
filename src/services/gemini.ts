import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `
Role: You are a High-Conversion E-commerce Strategist. Your task is to generate product data for a professional Amazon Affiliate website that follows a minimalist and premium UI/UX design.

Conversion Rules:
1. No "Add to Cart": Do not generate shopping cart logic. Focus only on direct Amazon checkout links.
2. Affiliate Language: Use CTA (Call to Action) text like "Check Price on Amazon" or "View Deal on Amazon".
3. Trust Signals: Include Amazon Star Ratings, Total Reviews, and "Prime Shipping" availability to build trust with US buyers.
4. UI Data Structure: Provide structured information that fits a clean, 2-column layout (Images on left, Details on right).

Data Format (CRITICAL):
Respond ONLY with a valid JSON array of objects. Do not include any introductory or concluding text. 

Schema for each object:
- id: The Amazon ASIN.
- name: (Mapped from product_title) Concise and professional title.
- brand: The manufacturer's name.
- price: (Mapped from current_price) Current estimated price (e.g., "$49.99").
- discount_percentage: e.g., "15% OFF".
- rating: e.g., "4.8 out of 5 stars".
- review_count: e.g., "12,450 ratings".
- category: One of the target categories (Smart Home, Kitchen, Pet, Mobile).
- highlights: An array of 4 key technical specs.
- description: A concise 2-sentence summary.
- description_bullets: 3-5 punchy benefit-driven points.
- image_url: Use the following pattern: https://ws-na.amazon-adsystem.com/widgets/q?_encoding=UTF8&Format=_SL600_&ASIN=[ASIN]&MarketPlace=US&ID=AsinImage&ServiceVersion=20070822&WS=1
- affiliate_link: https://www.amazon.com/dp/[ASIN]?tag=YOUR_TAG_HERE.
- trust_badge: "Best Seller" or "Amazon's Choice".

Quantity:
Always provide 12 to 15 products per request to fill the website's grid layout.

Tone:
Professional, premium, and trust-building.
`;

export const getGeminiResponse = async (userMessage: string) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined. Please check your environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userMessage,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json"
      }
    });
    
    const text = response.text || "";
    // If the model doesn't return JSON directly because of some reason, we trim it
    const sanitized = text.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(sanitized);
  } catch (error) {
    console.error("Failed to parse JSON response:", error);
    throw new Error("Invalid product data received from AI.");
  }
};

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
