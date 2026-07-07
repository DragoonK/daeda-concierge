import { Redis } from "@upstash/redis";
import { getActiveSchool } from "../../../lib/schools";

const SCHOOL = getActiveSchool();
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const redis = Redis.fromEnv();

async function tg(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) console.error(`[TG] ${method} failed:`, await res.text());
  return res;
}

function extractLead(text) {
  const tag = text.match(/\[LEAD:(.*?)\]/s);
  if (!tag) return null;
  const body = tag[1];
  const grab = (key) => {
    const m = body.match(
      new RegExp(`${key}\\s*=\\s*(.*?)(?:,\\s*(?:name|grade|phone)\\s*=|$)`, "i")
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

async function fireLeadWebhook(leadData) {
  if (!SCHOOL.appsScriptUrl || SCHOOL.appsScriptUrl.startsWith("PASTE_")) return;
  try {
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

export async function POST(req) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }

  const update = await req.json();
  const msg = update.message;
  if (!msg?.text) return new Response("ok", { status: 200 });

  const chatId = msg.chat.id;
  const userText = msg.text.trim();
  const histKey = `tg:hist:${chatId}`;
  const leadCapturedKey = `tg:lead:${chatId}`;

  if (userText === "/start") {
    await redis.del(histKey);
    await redis.del(leadCapturedKey);
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

  let history = [];
  try {
    history = (await redis.get(histKey)) || [];
  } catch (_) {
    history = [];
  }

  // Check if lead already captured for this chat
  let leadAlreadyCaptured = false;
  try {
    leadAlreadyCaptured = await redis.get(leadCapturedKey);
  } catch (_) {}

  history.push({ role: "user", content: userText });
  await tg("sendChatAction", { chat_id: chatId, action: "typing" });

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
      await tg("sendMessage", {
        chat_id: chatId,
        text: "Sorry, I had trouble responding. Please try again or call +855 99 200 011.",
      });
      return new Response("ok", { status: 200 });
    }

    const aiData = await aiRes.json();
    rawReply =
      aiData.content
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

  // Only fire lead webhook once per chat session
  const lead = extractLead(rawReply);
  if (lead && !leadAlreadyCaptured) {
    await fireLeadWebhook({
      parentName: lead.parentName,
      grade: lead.grade,
      phoneNumber: lead.phoneNumber,
      firstMessage: history[0]?.content?.slice(0, 200) || "",
      source: lead.source,
    });
    // Mark lead as captured for 7 days
    try {
      await redis.set(leadCapturedKey, "1", { ex: 60 * 60 * 24 * 7 });
    } catch (_) {}
  }

  const cleanReply = rawReply.replace(/\[LEAD:[^\]]+\]/g, "").trim();
  history.push({ role: "assistant", content: cleanReply });

  try {
    await redis.set(histKey, history.slice(-20), { ex: 86400 });
  } catch (_) {}

  await tg("sendMessage", {
    chat_id: chatId,
    text: cleanReply,
  });

  return new Response("ok", { status: 200 });
}
