function parseBase64Image(dataUrl) {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], data: dataUrl };
}

async function pollPrediction(predictionId, token, maxAttempts = 8) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();

    if (data.status === 'succeeded') {
      return { success: true, output: data.output };
    }
    if (data.status === 'failed' || data.status === 'canceled') {
      return { success: false, error: data.error || 'Prediction failed' };
    }
    // status is 'starting' or 'processing' — keep polling
  }
  return { success: false, error: 'STILL_PROCESSING', predictionId };
}

exports.handler = async function(event, context) {
  try {
    // Handle status-check requests for ongoing Replicate predictions
    if (event.httpMethod === 'GET' && event.queryStringParameters && event.queryStringParameters.checkId) {
      const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
      const predictionId = event.queryStringParameters.checkId;

      const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { 'Authorization': 'Bearer ' + REPLICATE_API_TOKEN }
      });
      const data = await res.json();

      if (data.status === 'succeeded') {
        const replicateUrl = Array.isArray(data.output) ? data.output[0] : data.output;
        // Download and convert to base64 to avoid CORS/expiry issues with the temporary Replicate URL
        try {
          const imgRes = await fetch(replicateUrl);
          const imgBuffer = await imgRes.arrayBuffer();
          const base64 = Buffer.from(imgBuffer).toString('base64');
          const contentType = imgRes.headers.get('content-type') || 'image/png';
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: `data:${contentType};base64,${base64}` })
          };
        } catch (downloadErr) {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: replicateUrl })
          };
        }
      }
      if (data.status === 'failed' || data.status === 'canceled') {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: data.error || 'Generation failed' })
        };
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processing: true, predictionId })
      };
    }

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
    const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

    const {
      customPrompt = '',
      concept = 'professional content creator',
      background = 'studio background',
      emotion = 'confident',
      style = 'cinematic, high contrast',
      format = 'horizontal',
      imageBase64 = null
    } = body;

    const formatContext = format === 'square'
      ? 'Professional channel logo, profile picture, centered composition, clean and iconic'
      : 'Professional YouTube thumbnail, high-CTR viral design';

    const visualDescription = customPrompt.length > 0
      ? customPrompt
      : `${concept}. Background: ${background}. Mood: ${emotion}`;

    const finalPrompt = `${formatContext}. ${visualDescription}. Style: ${style}. Photorealistic, ultra sharp, high contrast, professional lighting, 8k quality. No text, no letters, no words in the image.`;

    // ============ UPLOAD MODE — use Replicate InstantID for real face consistency ============
    if (imageBase64) {
      if (!REPLICATE_API_TOKEN) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Missing REPLICATE_API_TOKEN env variable' })
        };
      }

      const parsed = parseBase64Image(imageBase64);
      if (!parsed) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid uploaded image format' })
        };
      }

      const widths = { horizontal: 1024, vertical: 768, square: 1024 };
      const heights = { horizontal: 576, vertical: 1024, square: 1024 };

      const createRes = await fetch('https://api.replicate.com/v1/models/zsxkib/instant-id/predictions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + REPLICATE_API_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: {
            image: parsed.data,
            prompt: finalPrompt,
            width: widths[format] || 1024,
            height: heights[format] || 576,
            negative_prompt: 'text, letters, watermark, low quality, blurry, distorted face',
            ip_adapter_scale: 0.8,
            controlnet_conditioning_scale: 0.8
          }
        })
      });

      const createData = await createRes.json();

      if (createData.error) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Replicate: ' + JSON.stringify(createData.error) })
        };
      }

      if (!createData.id) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Replicate did not return a prediction ID. Response: ' + JSON.stringify(createData).substring(0, 250) })
        };
      }

      const result = await pollPrediction(createData.id, REPLICATE_API_TOKEN);

      if (!result.success) {
        if (result.error === 'STILL_PROCESSING') {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ processing: true, predictionId: result.predictionId })
          };
        }
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Replicate generation failed: ' + result.error })
        };
      }

      const replicateUrl = Array.isArray(result.output) ? result.output[0] : result.output;
      try {
        const imgRes = await fetch(replicateUrl);
        const imgBuffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(imgBuffer).toString('base64');
        const contentType = imgRes.headers.get('content-type') || 'image/png';
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: `data:${contentType};base64,${base64}` })
        };
      } catch (downloadErr) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: replicateUrl })
        };
      }
    }

    // ============ TEXT-TO-IMAGE MODE — use Stability AI (no photo needed) ============
    if (!STABILITY_API_KEY) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing STABILITY_API_KEY env variable' })
      };
    }

    const aspectRatios = { horizontal: '16:9', vertical: '9:16', square: '1:1' };
    const aspect_ratio = aspectRatios[format] || '16:9';

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
        body: JSON.stringify({ error: 'No image in response' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: `data:image/png;base64,${apiData.image}` })
    };

  } catch (err) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Caught exception: ' + err.message })
    };
  }
};
