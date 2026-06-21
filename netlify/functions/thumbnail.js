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
    const STABILITY_API_KEY = process.env.STABILITY_API_KEY;
    if (!STABILITY_API_KEY) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing STABILITY_API_KEY env variable' })
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

    // Stability AI aspect ratios
    const aspectRatios = {
      horizontal: '16:9',
      vertical: '9:16',
      square: '1:1'
    };
    const aspect_ratio = aspectRatios[format] || '16:9';

    const formatContext = format === 'square'
      ? 'Professional channel logo, profile picture, centered composition, clean and iconic'
      : 'Professional YouTube thumbnail, high-CTR viral design';

    const visualDescription = customPrompt.length > 0
      ? customPrompt
      : `${concept}. Background: ${background}. Mood: ${emotion}`;

    const textInstruction = includeText && text_overlay.trim().length > 0
      ? ` Bold readable text overlay saying "${text_overlay}", strong contrast, professional font, well positioned.`
      : ' No text, no letters, no words anywhere in the image, completely clean visual.';

    const finalPrompt = `${formatContext}. ${visualDescription}. Style: ${style}.${textInstruction} Photorealistic, ultra sharp, high contrast, professional lighting, designed to maximize clicks, 8k quality.`;

    // Stability AI v2beta - Stable Image Core endpoint
    const formData = new FormData();
    formData.append('prompt', finalPrompt);
    formData.append('aspect_ratio', aspect_ratio);
    formData.append('output_format', 'png');

    const apiResponse = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + STABILITY_API_KEY,
        'Accept': 'application/json'
      },
      body: formData
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Stability AI error: ' + errText.substring(0, 300) })
      };
    }

    const apiData = await apiResponse.json();

    if (!apiData.image) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No image in response: ' + JSON.stringify(apiData).substring(0, 200) })
      };
    }

    const imageUrl = `data:image/png;base64,${apiData.image}`;

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

