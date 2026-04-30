// server/features/ai/ai-vision.js — CityPulse AI Vision (Gemini)
// This file is ONLY loaded when GEMINI_API_KEY is present in .env
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dns = require("node:dns");

// Force IPv4 for Gemini API calls
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * PHASE 1: Initial Image Analysis
 * Detects category, department, and generates a rigid title.
 */
const analyzeCivicIssue = async (imageBuffer, mimeType) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      As a Civic Intelligence AI, analyze this image.
      
      RULES:
      1. Identify the category: pothole, garbage, electricity, water, sewage, vandalism, or other.
      2. Map to Department: 
         - pothole -> Roads
         - garbage -> SWM
         - electricity -> M&E
         - water -> Hydraulic
         - sewage -> Sewerage
         - vandalism -> Public Works
         - other -> General
      3. Generate a RIGID, PROFESSIONAL TITLE (max 50 chars). 
      4. Assign a severity_score (1-10).
      5. If the image is NOT a civic issue (person, food, animal), set is_valid to false.

      Return ONLY a JSON object:
      {
        "is_valid": boolean,
        "category": "pothole" | "garbage" | "electricity" | "water" | "sewage" | "vandalism" | "other",
        "department": "Roads" | "SWM" | "M&E" | "Hydraulic" | "Sewerage" | "Public Works" | "General",
        "title": "A rigid, formal title of the issue",
        "severity_score": number,
        "rejection_reason": "if invalid"
      }
    `;

    const imagePart = {
      inlineData: { data: imageBuffer.toString("base64"), mimeType },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text();
    const jsonStr = text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("AI Analysis Error:", error.message);
    throw error;
  }
};

/**
 * PHASE 2: Description Matching
 * Checks if the user's written text matches the actual image.
 */
const validateDescriptionMatch = async (imageBuffer, mimeType, userDescription) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Compare this image with the user's written description.
      USER DESCRIPTION: "${userDescription}"

      RULES:
      1. Does the description accurately describe what is seen in the photo?
      2. If the user is lying, being vague, or describing something NOT in the photo, set is_match to false.
      3. If it matches well, set is_match to true.

      Return ONLY a JSON object:
      {
        "is_match": boolean,
        "feedback": "If not a match, explain why briefly. If match, keep it empty."
      }
    `;

    const imagePart = {
      inlineData: { data: imageBuffer.toString("base64"), mimeType },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text();
    const jsonStr = text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("AI Match Error:", error.message);
    return { is_match: true, feedback: "" }; // Fallback to allow submission if API hangs
  }
};

/**
 * PHASE 3: Resolution Verification (AI Audit)
 * Compares before/after images to verify a civic issue was actually resolved.
 */
const verifyResolution = async (beforeBuffer, beforeMime, afterBuffer, afterMime) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are a Civic Resolution Auditor AI.
      
      You are given TWO images:
      - IMAGE 1: The BEFORE photo (original civic issue)
      - IMAGE 2: The AFTER photo (claimed resolution)

      RULES:
      1. Compare the two images carefully.
      2. Determine if the civic issue visible in the BEFORE image has been genuinely resolved in the AFTER image.
      3. Check for: same general location/angle, visible improvement, issue no longer present.
      4. If the after photo shows the same area but the issue persists, set is_resolved to false.
      5. If the after photo is clearly from a different location or is unrelated, set is_resolved to false.
      6. If the issue appears genuinely fixed (e.g., pothole filled, garbage cleared, wire repaired), set is_resolved to true.

      Return ONLY a JSON object:
      {
        "is_resolved": boolean,
        "confidence": number (0.0 to 1.0),
        "comment": "Brief explanation of your assessment"
      }
    `;

    const beforePart = {
      inlineData: { data: beforeBuffer.toString("base64"), mimeType: beforeMime },
    };
    const afterPart = {
      inlineData: { data: afterBuffer.toString("base64"), mimeType: afterMime },
    };

    const result = await model.generateContent([prompt, beforePart, afterPart]);
    const text = result.response.text();
    const jsonStr = text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("AI Resolution Verification Error:", error.message);
    return { is_resolved: true, confidence: 0, comment: "AI verification unavailable — manual resolution accepted." };
  }
};

module.exports = { analyzeCivicIssue, validateDescriptionMatch, verifyResolution };
