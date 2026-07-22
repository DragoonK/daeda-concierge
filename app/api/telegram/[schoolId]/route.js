import { Redis } from '@upstash/redis';
import Anthropic from '@anthropic-ai/sdk';
import { SCHOOLS as schools } from '../../../../lib/schools';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const HISTORY_TTL = 60 * 60 * 24 * 7;
const MAX_TURNS = 20;

// Matches your real lead tag format: [LEAD:name=X,grade=Y,phone=Z]
function grab(tag, key) {
  const m = tag.match(new RegExp(`${key}=([^,\\]]+)`));
  return m ? m[1].trim() : '';
}

export async function POST(req, { params }) {
  const sid = params.schoolId;
  const school = schools[sid];
  if (!school) return Response.json({ ok: false, error: 'unknown school' }, { status: 404 });

  const botToken = process.env[school.telegramBotTokenEnv];
  if (!botToken) {
    console.error(`Missing env var ${school.telegramBotTokenEnv} for school "${sid}"`);
    return Response.json({ ok: false, error: 'bot not configured' }, { status: 500 });
  }

  async function sendTelegram(chatId, text) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  }

  const update = await req.json();
  const msg = update.message;
  if (!msg?.text) return Response.json({ ok: true });

  const chatId = msg.chat.id;
  const userText = msg.text;

  let campaign = 'organic';
  if (userText.startsWith('/start')) {
    const payload = userText.split(' ')[1];
    if (payload) {
      campaign = payload;
      await redis.set(`tg:${sid}:campaign:${chatId}`, campaign, { ex: HISTORY_TTL });
    }
    const welcome = school.welcomeMessage || `Welcome to ${school.name}! How can I help?`;
    await sendTelegram(chatId, welcome);
    return Response.json({ ok: true });
  }

  const historyKey = `tg:${sid}:history:${chatId}`;
  const history = (await redis.get(historyKey)) || [];

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: school.systemPrompt,
    messages: [...history, { role: 'user', content: userText }],
  });

  let reply = response.content[0].text;

  // Matches [LEAD:name=X,grade=Y,phone=Z]
  const leadMatch = reply.match(/\[LEAD:[^\]]+\]/);
  if (leadMatch) {
    reply = reply.replace(leadMatch[0], '').trim();
    const dedupKey = `tg:${sid}:lead:${chatId}`;
    if (!(await redis.get(dedupKey))) {
      const storedCampaign = (await redis.get(`tg:${sid}:campaign:${chatId}`)) || campaign;
      await fetch(school.appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentName: grab(leadMatch[0], 'name'),
          grade: grab(leadMatch[0], 'grade'),
          phoneNumber: grab(leadMatch[0], 'phone'),
          firstMessage: history[0]?.content || userText,
          source: `telegram_${storedCampaign}`,
        }),
      });
      await redis.set(dedupKey, '1', { ex: HISTORY_TTL });
    }
  }

  const newHistory = [...history, { role: 'user', content: userText }, { role: 'assistant', content: reply }].slice(-MAX_TURNS);
  await redis.set(historyKey, newHistory, { ex: HISTORY_TTL });

  await sendTelegram(chatId, reply);
  return Response.json({ ok: true });
}
