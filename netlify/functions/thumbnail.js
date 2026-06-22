function parseBase64Image(dataUrl) {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], base64: match[2] };
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
      ? ` Include this exact text rendered boldly and clearly in the image with strong contrast and a professional eye-catching font: "${text_overlay}".`
      : ' Do not include any text, letters, or words in the image — keep it completely clean.';

    let promptText;
    if (imageBase64) {
      // EDIT MODE — preserve the person's identity from the uploaded photo
      promptText = `Using the person in the provided image, create a professional ${formatDesc}. Keep the SAME person — preserve their exact facial features, identity, and likeness precisely. Scene: ${visualDescription}. Style: ${style}.${textInstruction} Make it photorealistic, ultra sharp, high contrast, professional lighting, designed to maximize YouTube clicks.`;
    } else {
      // GENERATE MODE — from scratch
      promptText = `Create a professional ${formatDesc}. ${visualDescription}. Style: ${style}.${textInstruction} Photorealistic, ultra sharp, high contrast, professional lighting, designed to maximize YouTube clicks, 8k quality.`;
    }

    // Build the request parts
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

    // Nano Banana = gemini-2.5-flash-image
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: parts }]
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Gemini: ' + data.error.message })
      };
    }

    if (!data.candidates || !data.candidates[0]) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No image returned: ' + JSON.stringify(data).substring(0, 250) })
      };
    }

    // Extract the generated image from the response parts
    const responseParts = data.candidates[0].content.parts;
    let imageData = null;
    for (const part of responseParts) {
      if (part.inline_data && part.inline_data.data) {
        imageData = part.inline_data.data;
        break;
      }
      if (part.inlineData && part.inlineData.data) {
        imageData = part.inlineData.data;
        break;
      }
    }

    if (!imageData) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No image data in response. The model may have refused. Response: ' + JSON.stringify(data).substring(0, 250) })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: `data:image/png;base64,${imageData}` })
    };

  } catch (err) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Caught exception: ' + err.message })
    };
  }
};
