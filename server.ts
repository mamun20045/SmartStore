import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

// Load Firebase configuration for dynamic server-side meta injection
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : null;

async function fetchProductMetadata(productId: string) {
  if (!firebaseConfig) return null;
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/products/${productId}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Firestore REST fetch failed for ${productId}: status ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (!data.fields) return null;

    const fields = data.fields;
    const name = fields.name?.stringValue || "USA Smart Gadget product";
    
    let description = fields.description?.stringValue || "";
    if (description && description.length > 200) {
      description = description.substring(0, 197) + "...";
    } else if (!description) {
      description = `Check out the latest price for ${name} at USA Smart Gadget.`;
    }
    
    let image_url = fields.image_url?.stringValue || "";
    if (!image_url && fields.images?.arrayValue?.values && fields.images.arrayValue.values.length > 0) {
      image_url = fields.images.arrayValue.values[0].stringValue || "";
    }
    
    let price = fields.price?.stringValue || "";
    if (!price && fields.price?.doubleValue) {
      price = fields.price.doubleValue.toString();
    } else if (!price && fields.price?.integerValue) {
      price = fields.price.integerValue.toString();
    }
    
    return { name, description, image_url, price };
  } catch (err) {
    console.error("Error fetching product metadata:", err);
    return null;
  }
}

function injectMetaTags(html: string, product: any, reqUrl: string): string {
  if (!product) return html;
  
  const name = (product.name || "Product").trim();
  const priceStr = product.price ? ` - Price: $${product.price}` : "";
  const title = `${name}${priceStr} | USA Smart Gadget`;
  
  const desc = product.description || `Check out the latest price for ${name} at USA Smart Gadget.`;
  const image = product.image_url || "";
  
  // Clean existing title and meta tags to avoid duplication that confuses crawlers
  let cleanedHtml = html;
  cleanedHtml = cleanedHtml.replace(/<title>.*?<\/title>/gi, "");
  cleanedHtml = cleanedHtml.replace(/<meta\s+name=["']description["']\s+content=["'].*?["']\s*\/?>/gi, "");
  cleanedHtml = cleanedHtml.replace(/<meta\s+property=["']og:.*?["']\s+content=["'].*?["']\s*\/?>/gi, "");
  cleanedHtml = cleanedHtml.replace(/<meta\s+name=["']twitter:.*?["']\s+content=["'].*?["']\s*\/?>/gi, "");
  
  const metaTags = `
    <!-- Dynamic Open Graph Meta Tags for Facebook/Social Shares -->
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:url" content="${reqUrl}" />
    <meta property="og:type" content="product" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${image}" />
  `;
  
  // Inject at the beginning of <head>
  let transformed = cleanedHtml.replace("<head>", `<head>${metaTags}`);
  return transformed;
}

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

  // Dynamic HTML / Meta Injector for Social shares and crawlers
  app.use(async (req, res, next) => {
    const productId = req.query.product as string;
    
    // We only intercept if there's a product query parameter
    if (productId) {
      try {
        const product = await fetchProductMetadata(productId);
        if (product) {
          const isProd = process.env.NODE_ENV === "production";
          const indexPath = isProd 
            ? path.join(process.cwd(), "dist", "index.html")
            : path.join(process.cwd(), "index.html");
          
          if (fs.existsSync(indexPath)) {
            let html = fs.readFileSync(indexPath, "utf8");
            
            const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
            const fullUrl = `${protocol}://${req.get("host")}${req.originalUrl || req.url}`;
            const transformedHtml = injectMetaTags(html, product, fullUrl);
            
            res.setHeader("Content-Type", "text/html");
            return res.send(transformedHtml);
          }
        }
      } catch (err) {
        console.error("HTML injection failed, fallback to default serving:", err);
      }
    }
    next();
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
    // In Express 5, use '*all' to match everything for SPA.
    app.get("*all", (req, res) => {
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
