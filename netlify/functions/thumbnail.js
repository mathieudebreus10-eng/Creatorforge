// Helper: convert base64 data URL to a Buffer + mime type
function parseBase64Image(dataUrl) {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], 'base64'), ext: match[1].split('/')[1] };
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
      imageBase64 = null
    } = body;

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

    // Text is never baked into the AI image — always added via Canvas afterward for perfect spelling
    const finalPrompt = `${formatContext}. ${visualDescription}. Style: ${style}. Photorealistic, ultra sharp, high contrast, professional lighting, 8k quality. No text, no letters, no words in the image.`;

    let apiResponse;
    let endpoint;

    if (imageBase64) {
      // STRUCTURE MODE — uses uploaded photo's composition/structure as a guide while preserving identity better than img2img
      const parsed = parseBase64Image(imageBase64);
      if (!parsed) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid uploaded image format' })
        };
      }

      endpoint = 'https://api.stability.ai/v2beta/stable-image/control/structure';

      const boundary = '----TubervidBoundary' + Date.now();
      const parts = [];

      const appendField = (name, value) => {
        parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
      };

      appendField('prompt', finalPrompt + ' Keep the same person, same face, same identity as the reference image.');
      appendField('control_strength', '0.85'); // higher = follow uploaded photo's structure/identity more closely
      appendField('output_format', 'png');

      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="upload.${parsed.ext}"\r\nContent-Type: ${parsed.mime}\r\n\r\n`
      ));
      parts.push(parsed.buffer);
      parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

      const multipartBody = Buffer.concat(parts);

      apiResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + STABILITY_API_KEY,
          'Accept': 'application/json',
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body: multipartBody
      });

    } else {
      // TEXT-TO-IMAGE MODE — generate from scratch, aspect_ratio works here
      endpoint = 'https://api.stability.ai/v2beta/stable-image/generate/core';

      const formData = new FormData();
      formData.append('prompt', finalPrompt);
      formData.append('aspect_ratio', aspect_ratio);
      formData.append('output_format', 'png');

      apiResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + STABILITY_API_KEY,
          'Accept': 'application/json'
        },
        body: formData
      });
    }

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Stability AI error (' + endpoint.split('/').pop() + '): ' + errText.substring(0, 300) })
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
