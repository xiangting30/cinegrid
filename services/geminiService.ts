import { GoogleGenAI } from "@google/genai";
import { SHOT_PRESETS } from "../constants";

export const analyzeShotType = async (base64Image: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Clean base64 string if it has the prefix
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

    const prompt = `
      Analyze this image frame and determine its cinematic shot size and angle.
      Choose the best fit strictly from this list:
      ${SHOT_PRESETS.join(", ")}.
      
      If it fits none perfectly, provide a very short 2-3 word description (e.g. "Over the Shoulder").
      Return ONLY the label text, nothing else.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png', // Assuming PNG from canvas, but works for generic image analysis
              data: cleanBase64
            }
          },
          {
            text: prompt
          }
        ]
      }
    });

    return response.text?.trim() || "未知镜头";
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return "分析失败";
  }
};