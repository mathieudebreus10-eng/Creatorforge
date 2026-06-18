exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { topic, niche, tone, language } = JSON.parse(event.body);
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const lang = language || 'English';

  const prompt = `You are an expert YouTube content strategist.

Video topic: "${topic}"
Niche: ${niche || 'General'}
Tone: ${tone || 'Inspirational'}
Language: ${lang} — write ALL content in ${lang}.

Respond with ONLY raw JSON, no markdown, no backticks:

{"titles":["title1","title2","title3","title4","title5"],"hooks":["hook1","hook2","hook3"],"seo_description":"120-200 word SEO description","hashtags":["#tag1","#tag2","#tag3","#tag4","#tag5","#tag6","#tag7","#tag8","#tag9","#tag10"],"script":{"hook":"hook text","intro":"intro text","body":[{"section":"Point 1","content":"content"},{"section":"Point 2","content":"content"},{"section":"Point 3","content":"content"}],"outro":"outro text"},"thumbnail":{"background":"bg","main_image":"image","text_overlay":"3-4 WORDS","emotion":"emotion"}}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 2000,
        temperature: 0.7,
        messages: [
          { role: 'system', content: 'You are a YouTube content expert. Output raw JSON only. No markdown. No backticks.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const text = data.choices[0].message.content;
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    // Gerar tags a partir das hashtags — simples e garantido
    result.tags = (result.hashtags || [])
      .map(h => h.replace(/#/g, '').trim())
      .filter(t => t.length > 0);

    // Adicionar palavras do tópico como tags extras
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

