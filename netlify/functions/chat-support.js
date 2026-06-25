exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { message, history } = JSON.parse(event.body);
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  const systemPrompt = `You are the friendly support assistant for Tubervid, a YouTube Creator AI tool.

Tubervid helps YouTube creators turn any video topic into a full content package: 5 viral titles, a structured script (hook, intro, body, outro), an SEO description, 10-15 hashtags, YouTube tags, a thumbnail concept, and 3 opening hooks. It works for ANY niche (faith, business, fitness, education, music, gaming, travel, tech, lifestyle, etc).

Pricing: Free ($0, 10 generations/month), Basic ($9/month, 60 generations), Pro ($19/month, 275 generations), Creator ($29/month, 450 generations). One generation includes the full content package plus a thumbnail.

Support email: tubervidcontact@gmail.com. Team replies within 24 hours.

Instructions:
- ALWAYS reply in the same language the user is writing in (Portuguese, English, Spanish, French, etc) — detect it automatically.
- Be warm, natural, and conversational, like a helpful human support agent, not a robotic FAQ.
- Keep replies concise: 2-4 sentences usually, using emojis sparingly for warmth.
- If asked something unrelated to Tubervid (general chit-chat, jokes, etc), respond briefly and naturally, then gently steer back to how you can help with Tubervid.
- If you don't know a specific detail, be honest and suggest emailing support.
- Never invent features that don't exist.
- IMPORTANT: You are a support assistant ONLY. Never generate full content packages, scripts, hashtags, SEO descriptions, tags, thumbnail concepts, or any YouTube content inside this chat. If the user asks for content generation, politely redirect them to use the main Tubervid generator on the page instead.
- Do not use markdown formatting like ** or # in your reply, just plain conversational text with occasional emojis.`;

  let conversationText = systemPrompt + '\n\n--- Conversation so far ---\n';
  (history || []).slice(-8).forEach(m => {
    conversationText += `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}\n`;
  });
  conversationText += `User: ${message}\nAssistant:`;

  // ─── GEMINI with fallback ────────────────────────────────────────────────
  async function tryGemini(model) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: conversationText }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 300
          }
        })
      }
    );
    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Non-JSON (${response.status})`);
    }
    if (data.error) throw new Error(data.error.message);
    if (!data.candidates || !data.candidates.length) throw new Error('No candidates');
    return data.candidates[0].content.parts[0].text.trim();
  }

  // ─── GPT fallback ────────────────────────────────────────────────────────
  async function tryGPT() {
    if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
    const messages = [{ role: 'system', content: systemPrompt }];
    (history || []).slice(-8).forEach(m => {
      messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content });
    });
    messages.push({ role: 'user', content: message });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: messages,
        temperature: 0.8,
        max_tokens: 300
      })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content.trim();
  }

  // Try Gemini models, then GPT
  let reply = null;
  for (const model of ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest']) {
    try {
      reply = await tryGemini(model);
      break;
    } catch (err) {
      console.log('Chat Gemini error:', model, err.message);
    }
  }

  if (!reply) {
    try {
      reply = await tryGPT();
    } catch (err) {
      console.log('Chat GPT error:', err.message);
    }
  }

  if (!reply) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: "Sorry, I'm having trouble right now. Please email us at tubervidcontact@gmail.com and we'll help right away! 😊" })
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reply })
  };
};
