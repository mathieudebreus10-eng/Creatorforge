exports.handler = async function(event, context) {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Method must be POST' })
      };
    }
    if (!event.body) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No body received' })
      };
    }

    const body = JSON.parse(event.body);
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing OPENAI_API_KEY env variable' })
      };
    }

    const {
      customPrompt = '',
      concept = 'professional content creator',
      background = 'studio background',
      emotion = 'confident',
      style = 'cinematic, high contrast',
      format = 'horizontal',
      includeText = false,
      text_overlay = ''
    } = body;

    const allowedSizes = {
      square: '1024x1024',
      vertical: '1024x1536',
      horizontal: '1536x1024'
    };
    const size = allowedSizes[format] || allowedSizes.horizontal;

    const formatContext = format === 'square'
      ? 'Professional channel logo / profile picture, centered composition, clean and iconic'
      : 'Professional YouTube thumbnail, high-CTR design';

    const visualDescription = customPrompt.length > 0
      ? customPrompt
      : `${concept}. Background: ${background}. Mood: ${emotion}`;

    const textInstruction = includeText && text_overlay.trim().length > 0
      ? ` Include this exact bold text clearly readable in the image, well-positioned with strong contrast and a professional font: "${text_overlay}".`
      : ' Do not include any text, letters, or words anywhere in the image — keep it completely clean.';

    const finalPrompt = `${formatContext}. ${visualDescription}. Style: ${style}.${textInstruction} Photorealistic, ultra sharp, high contrast, professional lighting, designed to maximize clicks.`;

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
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'OpenAI returned non-JSON: ' + apiText.substring(0, 300) })
      };
    }

    if (apiData.error) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'OpenAI: ' + apiData.error.message })
      };
    }
    if (!apiData.data || !apiData.data[0]) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No image in response' })
      };
    }

    const imageData = apiData.data[0];
    const imageUrl = imageData.url
      ? imageData.url
      : `data:image/png;base64,${imageData.b64_json}`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl })
    };

  } catch (err) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Caught exception: ' + err.message })
    };
  }
};
