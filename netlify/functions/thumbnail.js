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

    const size = format === 'vertical' ? '1024x1792' : '1792x1024';

    const finalPrompt = customPrompt.length > 0
      ? `Professional YouTube thumbnail. ${customPrompt}. Style: ${style}. No text in image. Photorealistic, high contrast.`
      : `Professional YouTube thumbnail. ${concept}. Background: ${background}. Mood: ${emotion}. Style: ${style}. No text in image. Photorealistic, high contrast.`;

    const apiResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: finalPrompt,
        n: 1,
        size: size,
        quality: 'standard'
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

    if (!apiData.data || !apiData.data[0] || !apiData.data[0].url) {
      return { statusCode: 200, body: JSON.stringify({ error: 'No image URL in response: ' + JSON.stringify(apiData).substring(0,200) }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: apiData.data[0].url })
    };

  } catch (err) {
    return {
      statusCode: 200,
      body: JSON.stringify({ error: 'Caught exception: ' + err.message })
    };
  }
};
