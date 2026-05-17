export const getMarketingStrategy = async (productName: string, productLink: string) => {
  try {
    const response = await fetch("/api/marketing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ productName, productLink }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to fetch from API");
    }

    const data = await response.json();
    return data.text || "No strategy generated.";
  } catch (error) {
    console.error(error);
    return "Failed to generate marketing strategy. Make sure the server is configured with a GEMINI_API_KEY.";
  }
};
