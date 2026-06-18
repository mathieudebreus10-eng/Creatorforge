exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { concept, text_overlay, emotion, background, style, format, customPrompt } = JSON.parse(event.body);
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  const sizes = {
    horizontal: '1792x1024',
    vertical: '1024x1792'
  };

  const size = sizes[format] || sizes.horizontal;
  const formatLabel = format === 'vertical' ? 'vertical 9:16 YouTube Shorts' : 'horizontal 16:9 YouTube';

  try {
    // Use custom prompt if provided, otherwise build from concept data
    let prompt;
    if (customPrompt && customPrompt.trim().length > 0) {
      prompt = `Professional ${formatLabel} YouTube thumbnail. ${customPrompt}. 
Style: ${style || 'cinematic, high contrast, vibrant colors'}.
No text or letters in the image. Ultra sharp, professional YouTube thumbnail quality, eye-catching, designed to maximize clicks.`;
    } else {
      prompt = `Professional ${formatLabel} YouTube thumbnail, ultra high quality, eye-catching.
Style: ${style || 'cinematic, high contrast, vibrant colors'}.
Background: ${background}.
Main visual element: ${concept}.
Target emotion: ${emotion}.
Leave a clear area for text overlay "${text_overlay}".
No text, no letters, no words in the image itself.
Sharp, professional, high contrast, designed to get maximum clicks on YouTube.`;
    }

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
    if (data.error) throw new Error(data.error.message);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: data.data[0].url })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
