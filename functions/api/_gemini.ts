// One place for the Gemini model + endpoint, so a model change is one edit.
//
// gemini-2.5-flash is legacy (served only to projects that already used it).
// The 3.x models dropped `thinkingBudget` for `thinkingLevel`; sending the old
// `thinkingBudget: 0` is what 502'd every flyer OCR call when 3.x was first
// tried on 2026-08-31 — not the model id.
//
// 3.8 Flash over 3.5 Flash-Lite: on the same Lidl pages (2026-09-28) Flash-Lite
// pinned a nearby "Até -25%" banner onto an undiscounted item; Flash read all 20
// items right. Discounts drive deal picking, and it's ~$0.002/page either way.
export const GEMINI_MODEL = "gemini-3.8-flash";

export const geminiUrl = (apiKey: string, model = GEMINI_MODEL) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

// Spread into generationConfig for plain extraction / OCR / short text calls.
// "low" is 3.8 Flash's lowest level (thinking can't be fully off on 3.x).
export const MIN_THINKING = { thinkingConfig: { thinkingLevel: "low" } };
