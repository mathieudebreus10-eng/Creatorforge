exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { topic, niche, tone, language } = JSON.parse(event.body);
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const lang = language || 'English';

  if (!GEMINI_API_KEY) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing GEMINI_API_KEY env variable' })
    };
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

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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

    if (data.error) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Gemini: ' + data.error.message })
      };
    }

    if (!data.candidates || !data.candidates.length) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No candidates returned: ' + JSON.stringify(data).substring(0, 300) })
      };
    }

    const text = data.candidates[0].content.parts[0].text;
    const clean = text.replace(/```json|```/g, '').trim();

    let result;
    try {
      result = JSON.parse(clean);
    } catch (parseErr) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'JSON parse failed. Raw text: ' + clean.substring(0, 300) })
      };
    }

    // Gerar tags a partir das hashtags
    result.tags = (result.hashtags || [])
      .map(h => h.replace(/#/g, '').trim())
      .filter(t => t.length > 0);

    const topicTags = topic.split(' ')
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 3);

    result.tags = [...new Set([...result.tags, ...topicTags])].slice(0, 15);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };

  } catch (err) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Caught exception: ' + err.message })
    };
  }
};
