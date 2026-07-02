// app/api/telegram/route.js
// ─────────────────────────────────────────────────────────────
// CIA FIRST Telegram Bot — same brain as the web chatbot
// Uses Upstash Redis to store per-chat conversation history
// (Telegram webhooks are stateless; Redis gives us memory)
// ─────────────────────────────────────────────────────────────

import { Redis } from "@upstash/redis";
import { getActiveSchool } from "../../../lib/schools";

const SCHOOL = getActiveSchool();
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

// Redis client — auto-reads UPSTASH_REDIS_REST_URL + _TOKEN
const redis = Redis.fromEnv();

// ── Telegram helper ──────────────────────────────────────────
async function tg(method, payload) {
  const res = await fetch(
    `https://api.telegram.org/bot${TG_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    console.error(`[TG] ${method} failed:`, err);
  }
  return res;
}

// ── Lead extractor — identical contract to web route.js ──────
function extractLead(text) {
  const tag = text.match(/\[LEAD:(.*?)\]/s);
  if (!tag) return null;

  const body = tag[1];
  const grab = (key) => {
    const m = body.match(
      new RegExp(
        `${key}\\s*=\\s*(.*?)(?:,\\s*(?:name|grade|phone)\\s*=|$)`,
        "i"
      )
    );
    return m ? m[1].trim() : "";
  };

  const parentName = grab("name");
  const grade = grab("grade");
  const phoneNumber = grab("phone");

  if (!parentName || !grade || !phoneNumber) return null;

  return {
    parentName,
    grade,
    phoneNumber,
    date: new Date().toISOString(),
    source: `${SCHOOL.source} (Telegram)`,
  };
}

// ── Apps Script webhook ──────────────────────────────────────
async function fireLeadWebhook(leadData) {
  if (!SCHOOL.appsScriptUrl || SCHOOL.appsScriptUrl.startsWith("PASTE_")) {
    console.log("[TG LEAD] Apps Script URL not set — skipping webhook");
    return;
  }
  try {
    console.log("[TG LEAD] Sending:", JSON.stringify(leadData));
    await fetch(SCHOOL.appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(leadData),
      redirect: "follow",
    });
  } catch (err) {
    console.error("[TG LEAD] Webhook failed:", err.message);
  }
}

// ── Main webhook handler ─────────────────────────────────────
export async function POST(req) {

  // 1. Verify request is from Telegram
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    console.warn("[TG] Rejected request — wrong secret");
    return new Response("Forbidden", { status: 403 });
  }

  const update = await req.json();
  console.log("[TG] Update received:", JSON.stringify(update).slice(0, 200));

  // 2. Only handle text messages
  const msg = update.message;
  if (!msg?.text) {
    return new Response("ok", { status: 200 });
  }

  const chatId = msg.chat.id;
  const userText = msg.text.trim();
  const histKey = `tg:hist:${chatId}`;

  // 3. /start → reset history and greet
  if (userText === "/start") {
    await redis.del(histKey);
    await tg("sendMessage", {
      chat_id: chatId,
      text:
        `👋 Welcome to CIA FIRST International School!\n\n` +
        `I'm your admissions assistant — I can help with fees, campuses, programs (FTI/FTK/FTC), and enrolment.\n\n` +
        `What's your name? And which grade level are you enquiring about?\n\n` +
        `—\n` +
        `សួស្តី! ខ្ញុំអាចជួយអ្នកអំពីថ្លៃសិក្សា បរិវេណសាលា និងការចុះឈ្មោះ។ តើអ្នកឈ្មោះអ្វី?`,
    });
    return new Response("ok", { status: 200 });
  }

  // 4. Load conversation history from Redis (last 20 turns, 24hr TTL)
  let history = [];
  try {
    history = (await redis.get(histKey)) || [];
  } catch (_) {
    history = [];
  }

  // 5. Append user message
  history.push({ role: "user", content: userText });

  // 6. Show typing indicator
  await tg("sendChatAction", { chat_id: chatId, action: "typing" });

  // 7. Call Claude — same system prompt as the web bot
  let rawReply = "";
  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: SCHOOL.systemPrompt,
        messages: history,
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      console.error("[TG] Anthropic error:", err);
      await tg("sendMessage", {
        chat_id: chatId,
        text: "Sorry, I had trouble responding. Please try again or call +855 99 200 011.",
      });
      return new Response("ok", { status: 200 });
    }

    const aiData = await aiRes.json();
    rawReply = aiData.content
      ?.map((b) => (b.type === "text" ? b.text : ""))
      .filter(Boolean)
      .join("\n") || "Sorry, I had trouble responding.";

  } catch (err) {
    console.error("[TG] Claude call failed:", err.message);
    await tg("sendMessage", {
      chat_id: chatId,
      text: "Sorry, I had trouble responding. Please try again.",
    });
    return new Response("ok", { status: 200 });
  }

  // 8. Extract lead tag and fire webhook if complete
  console.log("[TG DEBUG] Raw reply tail:", rawReply.slice(-300));
  const lead = extractLead(rawReply);
  console.log("[TG DEBUG] Lead:", lead ? JSON.stringify(lead) : "none");

  if (lead) {
    await fireLeadWebhook({
      parentName:   lead.parentName,
      grade:        lead.grade,
      phoneNumber:  lead.phoneNumber,
      firstMessage: history[0]?.content?.slice(0, 200) || "",
      source:       lead.source,
    });
  }

  // 9. Strip lead tag from reply before sending to parent
  const cleanReply = rawReply.replace(/\[LEAD:[^\]]+\]/g, "").trim();

  // 10. Save updated history to Redis (cap at 20 messages, 24hr TTL)
  history.push({ role: "assistant", content: cleanReply });
  const trimmed = history.slice(-20);
  try {
    await redis.set(histKey, trimmed, { ex: 60 * 60 * 24 });
  } catch (err) {
    console.error("[TG] Redis save failed:", err.message);
  }

  // 11. Send reply to parent
  await tg("sendMessage", {
    chat_id: chatId,
    text: cleanReply,
  });

  return new Response("ok", { status: 200 });
}
