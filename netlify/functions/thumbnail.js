function parseBase64Image(dataUrl) {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], base64: match[2] };
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

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
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const STABILITY_API_KEY = process.env.STABILITY_API_KEY;

    if (!GEMINI_API_KEY) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing GEMINI_API_KEY env variable' })
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
      text_overlay = '',
      imageBase64 = null
    } = body;

    const formatDescriptions = {
      horizontal: 'wide 16:9 horizontal YouTube thumbnail composition',
      vertical: 'tall 9:16 vertical format for YouTube Shorts',
      square: 'square 1:1 format for a channel logo or profile picture'
    };
    const formatDesc = formatDescriptions[format] || formatDescriptions.horizontal;

    const visualDescription = customPrompt.length > 0
      ? customPrompt
      : `${concept}. Background: ${background}. Mood/emotion: ${emotion}`;

    const textInstruction = includeText && text_overlay.trim().length > 0
      ? ` Add this text ONCE, at the top of the image only, in large bold letters with strong outline: "${text_overlay}". Do NOT repeat this text anywhere else in the image. Only one single placement at the top. No duplicate text.`
      : ' Do not include any text, letters, words or numbers anywhere in the image. Keep it completely clean.';

    let promptText;
    if (imageBase64) {
      promptText = `Using the person in the provided image, create a professional ${formatDesc}. Keep the SAME person — preserve their exact facial features, identity, and likeness precisely. Scene: ${visualDescription}. Style: ${style}.${textInstruction} Make it photorealistic, ultra sharp, high contrast, professional lighting, designed to maximize YouTube clicks.`;
    } else {
      promptText = `Create a professional ${formatDesc}. ${visualDescription}. Style: ${style}.${textInstruction} Photorealistic, ultra sharp, high contrast, professional lighting, designed to maximize YouTube clicks, 8k quality.`;
    }

    const parts = [{ text: promptText }];

    if (imageBase64) {
      const parsed = parseBase64Image(imageBase64);
      if (!parsed) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid uploaded image format' })
        };
      }
      parts.push({
        inline_data: {
          mime_type: parsed.mime,
          data: parsed.base64
        }
      });
    }

    // ─── GEMINI IMAGE MODELS (in order of preference) ───────────────────────
    const geminiModels = [
      'gemini-2.5-flash-preview-05-20',  // 1st: Gemini 2.5 Flash (principal)
      'gemini-3.1-flash-image'            // 2nd: Gemini 3.1 Flash Image (fallback)
    ];

    async function tryGemini(model) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: parts }]
          })
        }
      );
      const data = await response.json();
      if (data.error) throw { code: data.error.code, message: data.error.message };
      if (!data.candidates || !data.candidates[0]) throw { code: 500, message: 'No candidates returned' };

      const responseParts = data.candidates[0].content.parts;
      for (const part of responseParts) {
        if (part.inline_data && part.inline_data.data) return part.inline_data.data;
        if (part.inlineData && part.inlineData.data) return part.inlineData.data;
      }
      throw { code: 500, message: 'No image data in response' };
    }

    // ─── STABILITY AI FALLBACK ───────────────────────────────────────────────
    async function tryStability() {
      if (!STABILITY_API_KEY) throw new Error('Missing STABILITY_API_KEY');

      const dimensionMap = {
        horizontal: { width: 1344, height: 768 },
        vertical:   { width: 768,  height: 1344 },
        square:     { width: 1024, height: 1024 }
      };
      const dim = dimensionMap[format] || dimensionMap.horizontal;

      const formData = new FormData();
      formData.append('prompt', promptText.substring(0, 500));
      formData.append('output_format', 'png');
      formData.append('width', dim.width);
      formData.append('height', dim.height);

      const response = await fetch(
        'https://api.stability.ai/v2beta/stable-image/generate/core',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${STABILITY_API_KEY}`,
            'Accept': 'image/*'
          },
          body: formData
        }
      );

      if (!response.ok) throw new Error('Stability AI error: ' + response.status);

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      return base64;
    }

    // ─── MAIN LOGIC: try Gemini models first, then Stability AI ─────────────
    let lastError = '';

    // Try each Gemini model with 2 retries each
    for (const model of geminiModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const imageData = await tryGemini(model);
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: `data:image/png;base64,${imageData}` })
          };
        } catch (err) {
          lastError = err.message || JSON.stringify(err);
          const code = err.code;
          // Only retry on overload errors
          if (code === 429 || code === 503 || code === 500) {
            await sleep(attempt * 2000);
            continue;
          }
          break; // Other errors — try next model
        }
      }
    }

    // Gemini failed — try Stability AI
    try {
      const imageData = await tryStability();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: `data:image/png;base64,${imageData}` })
      };
    } catch (stabilityErr) {
      lastError = stabilityErr.message;
    }

    // All failed
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'All image providers failed. Please try again in a few minutes. (' + lastError + ')' })
    };

  } catch (err) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Caught exception: ' + err.message })
    };
  }
};
