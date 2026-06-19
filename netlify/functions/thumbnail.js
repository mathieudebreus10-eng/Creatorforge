// Helper: convert base64 data URL to a Buffer + mime type
function parseBase64Image(dataUrl) {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], 'base64') };
}

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

    // gpt-image-1 supported sizes
    let size = '1536x1024';
    if (format === 'vertical') size = '1024x1536';
    if (format === 'square') size = '1024x1024';

    const formatContext = format === 'square'
      ? 'Professional channel logo / profile picture, centered composition, clean and iconic'
      : 'Professional YouTube thumbnail, high-CTR design';

    // Build the visual description
    const visualDescription = customPrompt.length > 0
      ? customPrompt
      : `${concept}. Background: ${background}. Mood: ${emotion}`;

    // Text instruction — only mention text if the user wants it baked in
    const textInstruction = includeText && text_overlay.trim().length > 0
      ? ` Include this exact bold text clearly readable in the image, well-positioned with strong contrast and a professional font: "${text_overlay}".`
      : ' Do not include any text, letters, or words anywhere in the image — keep it completely clean.';

    const finalPrompt = `${formatContext}. ${visualDescription}. Style: ${style}.${textInstruction} Photorealistic, ultra sharp, high contrast, professional lighting, designed to maximize clicks.`;

    let apiResponse;

    if (imageBase64) {
      // EDIT MODE — use the uploaded photo as the base so the person's face/identity is preserved
      const parsed = parseBase64Image(imageBase64);
      if (!parsed) {
        return { statusCode: 200, body: JSON.stringify({ error: 'Invalid uploaded image format' }) };
      }

      // Build multipart/form-data manually (no external deps available in Netlify Functions by default)
      const boundary = '----TubervidBoundary' + Date.now();
      const parts = [];

      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\ngpt-image-1\r\n`
      ));
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\n${finalPrompt}\r\n`
      ));
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="size"\r\n\r\n${size}\r\n`
      ));
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="upload.png"\r\nContent-Type: ${parsed.mime}\r\n\r\n`
      ));
      parts.push(parsed.buffer);
      parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

      const multipartBody = Buffer.concat(parts);

      apiResponse = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + OPENAI_API_KEY,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body: multipartBody
      });

    } else {
      // GENERATE MODE — create from scratch
      apiResponse = await fetch('https://api.openai.com/v1/images/generations', {
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
    }

    const apiText = await apiResponse.text();
    let apiData;
    try {
      apiData = JSON.parse(apiText);
    } catch (parseErr) {
      return { statusCode: 200, body: JSON.stringify({ error: 'OpenAI returned non-JSON (likely timeout): ' + apiText.substring(0, 200) }) };
    }

    if (apiData.error) {
      return { statusCode: 200, body: JSON.stringify({ error: 'OpenAI: ' + apiData.error.message }) };
    }
    if (!apiData.data || !apiData.data[0]) {
      return { statusCode: 200, body: JSON.stringify({ error: 'No image in response' }) };
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
      body: JSON.stringify({ error: 'Caught exception: ' + err.message })
    };
  }
};
