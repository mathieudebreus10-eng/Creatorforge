exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { message, history } = JSON.parse(event.body);
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  const systemPrompt = `You are the friendly support assistant for Tubervid, a YouTube Creator AI tool.

Tubervid helps YouTube creators turn any video topic into a full content package: 5 viral titles, a structured script (hook, intro, body, outro), an SEO description, 10-15 hashtags, a thumbnail concept, and 3 opening hooks. It works for ANY niche (faith, business, fitness, education, music, gaming, travel, tech, lifestyle, etc).

Pricing: Free ($0, 3 generations/month), Basic ($9/month, 20 generations), Pro ($19/month, 60 generations + section regeneration + history), Creator ($29/month, unlimited generations + API access + bulk mode).

Support email: tubervidcontact@gmail.com. Team replies within 24 hours.

Instructions:
- ALWAYS reply in the same language the user is writing in (Portuguese, English, Spanish, French, etc) — detect it automatically.
- Be warm, natural, and conversational, like a helpful human support agent, not a robotic FAQ.
- Keep replies concise: 2-4 sentences usually, using emojis sparingly for warmth.
- If asked something unrelated to Tubervid (general chit-chat, jokes, etc), respond briefly and naturally, then gently steer back to how you can help with Tubervid.
- If you don't know a specific detail (like exact uptime stats), be honest and suggest emailing support.
- Never invent features that don't exist.
- Do not use markdown formatting like ** or # in your reply, just plain conversational text with occasional emojis.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(history || []).slice(-8),
    { role: 'user', content: message }
  ];

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 300,
        temperature: 0.8,
        messages: messages
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    const reply = data.choices[0].message.content;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};

