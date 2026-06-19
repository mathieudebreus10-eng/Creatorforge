exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const { concept, text_overlay, emotion, background, style, format, customPrompt } = body;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      return {
        statusCode: 200,
        body: JSON.stringify({ error: 'API key not configured' })
      };
    }

    const sizes = {
      horizontal: '1792x1024',
      vertical: '1024x1792'
    };

    const size = sizes[format] || '1792x1024';

    const prompt = customPrompt && customPrompt.trim().length > 0
      ? `Professional YouTube thumbnail. ${customPrompt}. No text in image. Photorealistic, high contrast, professional.`
      : `Professional YouTube thumbnail. ${concept}. Background: ${background}. Mood: ${emotion}. Style: ${style}. No text in image. Photorealistic, high contrast.`;

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: size,
        quality: 'standard'
      })
    });

    const data = await response.json();

    // Return full error details for debugging
    if (data.error) {
      return {
        statusCode: 200,
        body: JSON.stringify({ error: `OpenAI Error: ${data.error.type} — ${data.error.message}` })
      };
    }

    if (!data.data || !data.data[0]) {
      return {
        statusCode: 200,
        body: JSON.stringify({ error: `Unexpected response: ${JSON.stringify(data)}` })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: data.data[0].url })
    };

  } catch (err) {
    return {
      statusCode: 200,
      body: JSON.stringify({ error: `Server error: ${err.message}` })
    };
  }
};
