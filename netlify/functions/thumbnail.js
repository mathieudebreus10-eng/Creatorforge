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
    let prompt;
    if (customPrompt && customPrompt.trim().length > 0) {
      // Clean and safe version of custom prompt
      prompt = `Professional ${formatLabel} YouTube thumbnail image.
Visual description: ${customPrompt}.
Style: ${style || 'cinematic, high contrast, vibrant colors'}.
Requirements: photorealistic, ultra sharp, high contrast, professional lighting, no text, no letters, no words anywhere in the image. Designed to maximize YouTube clicks.`;
    } else {
      prompt = `Professional ${formatLabel} YouTube thumbnail image.
Background: ${background}.
Main subject: ${concept}.
Mood and emotion: ${emotion}.
Style: ${style || 'cinematic, high contrast, vibrant colors'}.
Requirements: photorealistic, ultra sharp, high contrast, professional lighting, no text, no letters, no words anywhere in the image. Leave space for text overlay. Designed to maximize YouTube clicks.`;
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
    
    if (data.error) {
      // Return specific error message
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: data.error.code === 'content_policy_violation' 
            ? 'Try describing the image differently — avoid specific names or sensitive words.'
            : data.error.message 
        })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: data.data[0].url })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Generation failed. Please try again with a different description.' })
    };
  }
};
