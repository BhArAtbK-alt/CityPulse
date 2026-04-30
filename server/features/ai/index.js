// server/features/ai/index.js — AI Feature Gate
// This barrel module checks if AI is configured and exports accordingly.
// If GEMINI_API_KEY is not set, all AI functions become safe no-ops.

const AI_ENABLED = !!process.env.GEMINI_API_KEY;

let analyzeCivicIssue, validateDescriptionMatch, verifyResolution;

if (AI_ENABLED) {
  const vision = require("./ai-vision");
  analyzeCivicIssue = vision.analyzeCivicIssue;
  validateDescriptionMatch = vision.validateDescriptionMatch;
  verifyResolution = vision.verifyResolution;
  console.log("🤖 AI Features: ENABLED (Gemini Vision Active)");
} else {
  // Safe no-op stubs — these should never be called due to route guards,
  // but exist as a safety net.
  analyzeCivicIssue = async () => { throw new Error("AI not configured"); };
  validateDescriptionMatch = async () => ({ is_match: true, feedback: "" });
  verifyResolution = async () => ({ is_resolved: true, confidence: 0, comment: "AI not configured — manual resolution accepted." });
  console.log("💡 AI Features: DISABLED (Set GEMINI_API_KEY in .env to enable)");
}

module.exports = {
  AI_ENABLED,
  analyzeCivicIssue,
  validateDescriptionMatch,
  verifyResolution,
};
