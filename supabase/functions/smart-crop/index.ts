import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, width, height } = await req.json();

    if (!imageBase64 || !width || !height) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: imageBase64, width, height" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Processing smart crop for image: ${width}x${height}`);

    // Determine mime type from base64 prefix or default to jpeg
    let mimeType = "image/jpeg";
    if (imageBase64.startsWith("/9j/")) {
      mimeType = "image/jpeg";
    } else if (imageBase64.startsWith("iVBOR")) {
      mimeType = "image/png";
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are an image analyzer that detects FACES and PETS (cats and dogs).

Your task:
1. Determine if there are any human faces or pets (cats/dogs) in the image. A bare arm, leg, torso, hand, or back-of-head without a visible face does NOT count — only count it if a face is visible.
2. If YES: return a crop region that keeps all detected faces and pets visible with breathing room. Set skipCrop to false. Prioritize faces over pets if both are present.
3. If NO faces or pets: set skipCrop to true. The x/y/width/height values don't matter when skipCrop is true, but fill them with 0/0/1/1.

COORDINATE FORMAT — CRITICAL:
All of x, y, width, height MUST be normalized floats between 0.0 and 1.0, where 0.0 is the left/top edge and 1.0 is the right/bottom edge of the image. DO NOT use percentages (0–100). DO NOT use pixel values. DO NOT use the 0–1000 normalized box format.

Example for a face in the upper-left quadrant:
{"x":0.10,"y":0.20,"width":0.28,"height":0.28,"confidence":0.95,"subjects":"woman's face","skipCrop":false}

Respond with ONLY a JSON object in this exact format:
{
  "x": <0.0-1.0 fraction from left edge>,
  "y": <0.0-1.0 fraction from top edge>,
  "width": <0.0-1.0 fraction of image width>,
  "height": <0.0-1.0 fraction of image height>,
  "confidence": <0-1 confidence score>,
  "subjects": "<description of what you see>",
  "skipCrop": <true if no faces/pets detected, false otherwise>
}`
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
              {
                type: "text",
                text: `Analyze this ${width}x${height} image. Are there any human faces or pets (cats/dogs)? If yes, return the optimal crop region focusing on the subjects (prioritize faces over pets) using normalized 0.0–1.0 coordinates (NOT percentages, NOT pixels). If no faces or pets, set skipCrop to true. Return ONLY the JSON object.`
              }
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "smart_crop",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                x: { type: "number", minimum: 0, maximum: 1 },
                y: { type: "number", minimum: 0, maximum: 1 },
                width: { type: "number", minimum: 0, maximum: 1 },
                height: { type: "number", minimum: 0, maximum: 1 },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                subjects: { type: "string" },
                skipCrop: { type: "boolean" },
              },
              required: ["x", "y", "width", "height", "confidence", "subjects", "skipCrop"],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI model");
    }

    console.log("AI response:", content);

    // Parse the JSON from the response
    let cropData;
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cropData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      // Fallback to center crop
      cropData = {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        confidence: 0,
        subjects: "Unable to analyze",
        skipCrop: true,
      };
    }

    // Defensive normalization: detect which coordinate space the model returned.
    // Expected: 0.0–1.0 floats. But Gemini sometimes returns 0–100 percentages or
    // 0–1000 normalized box coords. Pick a divisor based on the largest value.
    const maxVal = Math.max(
      Number(cropData.x) || 0,
      Number(cropData.y) || 0,
      Number(cropData.width) || 0,
      Number(cropData.height) || 0,
    );
    let divisor = 1;
    let coordSpace = "normalized-0-1";
    if (maxVal > 100) {
      divisor = 1000;
      coordSpace = "normalized-0-1000";
    } else if (maxVal > 1.5) {
      divisor = 100;
      coordSpace = "percent-0-100";
    }
    console.log(
      `Coord interpretation: ${coordSpace} (maxVal=${maxVal}, divisor=${divisor}). Raw cropData:`,
      JSON.stringify(cropData),
    );

    let cropRegion: CropRegion = {
      x: Math.round((cropData.x / divisor) * width),
      y: Math.round((cropData.y / divisor) * height),
      width: Math.round((cropData.width / divisor) * width),
      height: Math.round((cropData.height / divisor) * height),
    };

    // Ensure the crop is within bounds
    cropRegion.x = Math.max(0, Math.min(cropRegion.x, width - 50));
    cropRegion.y = Math.max(0, Math.min(cropRegion.y, height - 50));
    cropRegion.width = Math.max(50, Math.min(cropRegion.width, width - cropRegion.x));
    cropRegion.height = Math.max(50, Math.min(cropRegion.height, height - cropRegion.y));

    // Validate aspect ratio and minimum dimensions
    const aspectRatio = cropRegion.width / cropRegion.height;
    const minDimension = Math.min(width, height) * 0.2;
    
    // Check if crop is too extreme (aspect ratio > 3:1 or < 1:3, or dimensions too small)
    if (cropRegion.width < minDimension || cropRegion.height < minDimension || 
        aspectRatio > 3 || aspectRatio < 0.33) {
      console.log("Invalid crop detected, falling back to center crop. Original:", cropRegion, "Aspect ratio:", aspectRatio);
      // Fall back to 80% center crop
      cropRegion = {
        x: Math.round(width * 0.1),
        y: Math.round(height * 0.1),
        width: Math.round(width * 0.8),
        height: Math.round(height * 0.8),
      };
    }

    console.log("Smart crop result:", cropRegion, "Subjects:", cropData.subjects);

    const skipCrop = cropData.skipCrop ?? false;

    // If skipCrop, return full image as crop region
    if (skipCrop) {
      console.log("No people detected, skipCrop=true. Subjects:", cropData.subjects);
      return new Response(
        JSON.stringify({
          crop: { x: 0, y: 0, width, height },
          confidence: cropData.confidence ?? 0.5,
          subjects: cropData.subjects,
          skipCrop: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        crop: cropRegion,
        confidence: cropData.confidence,
        subjects: cropData.subjects,
        skipCrop: false,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Smart crop error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
