import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/marketing", async (req, res) => {
    try {
      const { productName, productLink } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
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

      res.json({ text: response.text });
    } catch (error) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: "Failed to generate content." });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    console.log("Loading Vite dev middleware...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static files from dist...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // In Express 5, '*' is literal. Use '/*' or '(.*)' to match everything for SPA.
    app.get("/*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("CRITICAL: Server failed to start:", err);
  process.exit(1);
});
