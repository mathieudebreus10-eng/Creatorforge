exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { topic, niche, tone, language, token } = JSON.parse(event.body);
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const lang = language || 'English';

  if (!GEMINI_API_KEY) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing GEMINI_API_KEY env variable' })
    };
  }

  // ─── CHECK & INCREMENT USAGE LIMIT ───────────────────────────────────────
  if (token) {
    try {
      const usageRes = await fetch(`${process.env.URL}/.netlify/functions/check-usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'increment' })
      });
      const usageData = await usageRes.json();

      if (usageData.limit_reached) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: usageData.error, limit_reached: true, plan: usageData.plan })
        };
      }
      if (usageData.error && !usageData.allowed) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: usageData.error })
        };
      }
    } catch (e) {
      // If usage check fails, allow generation (don't block user)
      console.log('Usage check failed:', e.message);
    }
  }

  const prompt = `You are a world-class YouTube growth strategist and viral content expert with 10+ years experience helping creators grow to millions of subscribers.

Video topic: "${topic}"
Niche: ${niche || 'General'}
Tone: ${tone || 'Inspirational'}
Language: ${lang} — write ALL content in ${lang}.

Your goal: Create content that gets MAXIMUM clicks, watch time, and shares.

TITLE RULES — each title must use one of these proven viral formulas:
- Curiosity gap: "The Secret Nobody Tells You About..."
- Number list: "7 Things That Will Change Your..."
- Personal story: "I Did X for 30 Days — Here's What Happened"
- Controversy: "Why Everyone Is Wrong About..."
- Result promise: "How I [Result] in [Time] Without [Pain Point]"
- Shocking truth: "The Real Reason Why..."

HOOK RULES — first 15 seconds must:
- Start with a shocking statement, question, or bold claim
- Create immediate curiosity or emotional tension
- Promise a clear benefit or transformation

SCRIPT RULES:
- Hook must stop the scroll in 3 seconds
- Intro must build credibility and promise value
- Body must deliver on the promise with specific, actionable content
- Outro must drive action (subscribe, comment, share)

SEO DESCRIPTION RULES:
- First sentence must contain the main keyword
- Include a clear call to action
- 150-200 words with natural keyword placement

Respond with ONLY this JSON structure, nothing else:

{"titles":["viral title 1","viral title 2","viral title 3","viral title 4","viral title 5"],"hooks":["powerful hook 1","powerful hook 2","powerful hook 3"],"seo_description":"150-200 word SEO description","hashtags":["#hashtag1","#hashtag2","#hashtag3","#hashtag4","#hashtag5","#hashtag6","#hashtag7","#hashtag8","#hashtag9","#hashtag10"],"script":{"hook":"Powerful 15-second hook script","intro":"30-60 second intro","body":[{"section":"Key Point 1","content":"Script content"},{"section":"Key Point 2","content":"Script content"},{"section":"Key Point 3","content":"Script content"}],"outro":"Strong call to action"},"thumbnail":{"background":"Background description","main_image":"Main visual element","text_overlay":"3-4 WORD HOOK","emotion":"Target emotion"}}`;

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  async function tryGemini(model) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.85,
            maxOutputTokens: 8000,
            responseMimeType: "application/json"
          }
        })
      }
    );
    const data = await response.json();
    if (data.error) throw { code: data.error.code, message: data.error.message };
    if (!data.candidates || !data.candidates.length) throw { code: 500, message: 'No candidates' };
    return data.candidates[0].content.parts[0].text;
  }

  async function tryGPT() {
    if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.85,
        max_tokens: 8000,
        response_format: { type: 'json_object' }
      })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content;
  }

  function parseAndBuild(text) {
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    result.tags = (result.hashtags || [])
      .map(h => h.replace(/#/g, '').trim())
      .filter(t => t.length > 0);
    const topicTags = topic.split(' ')
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 3);
    result.tags = [...new Set([...result.tags, ...topicTags])].slice(0, 15);
    return result;
  }

  const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  let lastError = '';

  for (const model of geminiModels) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const text = await tryGemini(model);
        const result = parseAndBuild(text);
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result)
        };
      } catch (err) {
        lastError = err.message || JSON.stringify(err);
        const code = err.code;
        if (code === 429 || code === 503 || code === 500) {
          await sleep(attempt * 2000);
          continue;
        }
        break;
      }
    }
  }

  // GPT-4.1 Mini fallback
  try {
    const text = await tryGPT();
    const result = parseAndBuild(text);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };
  } catch (gptErr) {
    lastError = gptErr.message;
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'AI is under heavy load. Please try again in a few minutes. (' + lastError + ')' })
  };
};
