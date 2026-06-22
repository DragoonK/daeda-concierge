// app/api/chat/route.js
// If your project has the "@/*" path alias set up, you can use
//   import { getActiveSchool } from "@/lib/schools";
// Otherwise this relative path works from app/api/chat/ :
import { getActiveSchool } from "../../../lib/schools";

// Resolved once per deployment (SCHOOL_ID is a Vercel env var, constant at runtime)
const SCHOOL = getActiveSchool();

/**
 * Send captured lead data to this school's Google Sheet via Apps Script
 */
async function fireLeadWebhook(leadData, appsScriptUrl) {
  try {
    console.log("[LEAD CAPTURE] Sending to Google Sheets:", JSON.stringify(leadData));

    const response = await fetch(appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(leadData),
      redirect: "follow",
    });

    const responseText = await response.text();
    console.log("[LEAD CAPTURE] Google Sheets response:", response.status, responseText);

    return { success: true, response: responseText };
  } catch (err) {
    console.error("[LEAD CAPTURE] Webhook failed:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Extract lead data from Claude's response
 * Looks for: [LEAD:name=X,grade=Y,phone=Z]
 */
function extractLead(text) {
  const match = text.match(/\[LEAD:name=([^,]+),grade=([^,]+),phone=([^\]]+)\]/);
  if (!match) return null;
  return {
    parentName: match[1].trim(),
    grade: match[2].trim(),
    phoneNumber: match[3].trim(),
    date: new Date().toISOString(),
    source: SCHOOL.source,
  };
}

export async function POST(request) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: "Messages array required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "API key not configured" }, { status: 500 });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: SCHOOL.systemPrompt,
        messages: messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", err);
      return Response.json({ error: "AI service error" }, { status: 502 });
    }

    const data = await response.json();

    const rawText =
      data.content
        ?.map((block) => (block.type === "text" ? block.text : ""))
        .filter(Boolean)
        .join("\n") || "Sorry, I had trouble responding.";

    // DEBUG: Log the tail of Claude's response to verify [LEAD:] tag
    console.log("[DEBUG] Raw AI response (last 300 chars):", rawText.slice(-300));

    // Extract lead and fire webhook if all 3 fields present
    const lead = extractLead(rawText);
    console.log("[DEBUG] Lead extraction result:", lead ? JSON.stringify(lead) : "NO LEAD TAG FOUND");

    if (lead) {
      console.log("[LEAD CAPTURE] Lead detected:", JSON.stringify(lead));

      const firstMessage = messages.find((m) => m.role === "user")?.content || "";

      // Send to this school's sheet — field names match the Apps Script doPost() exactly
      try {
        await fireLeadWebhook(
          {
            parentName: lead.parentName,
            grade: lead.grade,
            phoneNumber: lead.phoneNumber,
            firstMessage: firstMessage.slice(0, 200),
            source: SCHOOL.source,
          },
          SCHOOL.appsScriptUrl
        );
      } catch (webhookErr) {
        console.error("[LEAD CAPTURE] Webhook threw:", webhookErr.message);
      }
    }

    // Strip lead tag before sending reply to frontend
    const cleanText = rawText.replace(/\[LEAD:[^\]]+\]/g, "").trim();

    return Response.json({ reply: cleanText });
  } catch (err) {
    console.error("Chat API error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}