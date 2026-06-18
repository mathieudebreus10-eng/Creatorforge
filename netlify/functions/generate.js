exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { topic, niche, tone, language } = JSON.parse(event.body);
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const lang = language || 'English';

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

Respond with ONLY raw JSON, no markdown, no backticks:

{"titles":["viral title 1","viral title 2","viral title 3","viral title 4","viral title 5"],"hooks":["powerful hook 1","powerful hook 2","powerful hook 3"],"seo_description":"150-200 word SEO description","hashtags":["#hashtag1","#hashtag2","#hashtag3","#hashtag4","#hashtag5","#hashtag6","#hashtag7","#hashtag8","#hashtag9","#hashtag10"],"script":{"hook":"Powerful 15-second hook script that stops the scroll","intro":"30-60 second intro that builds credibility and promises value","body":[{"section":"Key Point 1 with specific detail","content":"Detailed, engaging script content with examples"},{"section":"Key Point 2 with specific detail","content":"Detailed, engaging script content with examples"},{"section":"Key Point 3 with specific detail","content":"Detailed, engaging script content with examples"}],"outro":"Strong call to action — subscribe, comment, share"},"thumbnail":{"background":"Specific background that creates contrast and emotion","main_image":"Specific visual element that creates curiosity","text_overlay":"3-4 WORD HOOK","emotion":"Specific emotion that drives clicks"}}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 2500,
        temperature: 0.85,
        messages: [
          { role: 'system', content: 'You are a world-class YouTube viral content expert. You create titles and scripts that consistently get millions of views. Output raw JSON only. No markdown. No backticks.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const text = data.choices[0].message.content;
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

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
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
