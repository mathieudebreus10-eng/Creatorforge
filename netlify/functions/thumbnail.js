exports.handler = async function(event, context) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 200, body: JSON.stringify({ error: 'Method must be POST' }) };
    }

    if (!event.body) {
      return { statusCode: 200, body: JSON.stringify({ error: 'No body received' }) };
    }

    const body = JSON.parse(event.body);
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      return { statusCode: 200, body: JSON.stringify({ error: 'Missing OPENAI_API_KEY env variable' }) };
    }

    const customPrompt = body.customPrompt || '';
    const concept = body.concept || 'professional content creator';
    const background = body.background || 'studio background';
    const emotion = body.emotion || 'confident';
    const style = body.style || 'cinematic, high contrast';
    const format = body.format || 'horizontal';

    // gpt-image-1 supported sizes
    let size = '1536x1024'; // horizontal default
    if (format === 'vertical') size = '1024x1536';
    if (format === 'square') size = '1024x1024';

    const formatContext = format === 'square' 
      ? 'Professional channel logo / profile picture, centered composition, clean and iconic' 
      : 'Professional YouTube thumbnail';

    const finalPrompt = customPrompt.length > 0
      ? `${formatContext}. ${customPrompt}. Style: ${style}. No text in image. Photorealistic, high contrast.`
      : `${formatContext}. ${concept}. Background: ${background}. Mood: ${emotion}. Style: ${style}. No text in image. Photorealistic, high contrast.`;

    const apiResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: finalPrompt,
        n: 1,
        size: size
      })
    });

    const apiText = await apiResponse.text();
    let apiData;
    try {
      apiData = JSON.parse(apiText);
    } catch (parseErr) {
      return { statusCode: 200, body: JSON.stringify({ error: 'OpenAI returned non-JSON: ' + apiText.substring(0, 200) }) };
    }

    if (apiData.error) {
      return { statusCode: 200, body: JSON.stringify({ error: 'OpenAI: ' + apiData.error.message }) };
    }

    if (!apiData.data || !apiData.data[0]) {
      return { statusCode: 200, body: JSON.stringify({ error: 'No image in response: ' + JSON.stringify(apiData).substring(0,200) }) };
    }

    // gpt-image-1 returns base64, not a URL
    const imageData = apiData.data[0];
    const imageUrl = imageData.url 
      ? imageData.url 
      : `data:image/png;base64,${imageData.b64_json}`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: imageUrl })
    };

  } catch (err) {
    return {
      statusCode: 200,
      body: JSON.stringify({ error: 'Caught exception: ' + err.message })
    };
  }
};
