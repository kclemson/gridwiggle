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
            content: `You are an expert image composition analyzer. Your task is to analyze photos and determine the optimal crop region that focuses on the main subject(s) - typically faces, people, or central objects of interest.

Rules:
1. Identify faces, people, and main subjects in the image
2. Return a crop region that keeps all important subjects visible
3. The crop should be aesthetically pleasing with good composition
4. Maintain some breathing room around subjects
5. If there are faces, ensure they are NOT cut off
6. Return coordinates as percentages (0-100) of the original image dimensions

You must respond with ONLY a JSON object in this exact format:
{
  "x": <percentage from left edge>,
  "y": <percentage from top edge>,
  "width": <percentage of image width>,
  "height": <percentage of image height>,
  "confidence": <0-1 confidence score>,
  "subjects": "<description of detected subjects>"
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
                text: `Analyze this ${width}x${height} image and provide the optimal smart crop region that focuses on the main subjects (faces, people, or central objects). Return ONLY the JSON object with percentage-based coordinates.`
              }
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
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
        x: 10,
        y: 10,
        width: 80,
        height: 80,
        confidence: 0.5,
        subjects: "Unable to analyze, using center crop"
      };
    }

    // Convert percentages to pixel coordinates
    const cropRegion: CropRegion = {
      x: Math.round((cropData.x / 100) * width),
      y: Math.round((cropData.y / 100) * height),
      width: Math.round((cropData.width / 100) * width),
      height: Math.round((cropData.height / 100) * height),
    };

    // Ensure the crop is within bounds
    cropRegion.x = Math.max(0, Math.min(cropRegion.x, width - 50));
    cropRegion.y = Math.max(0, Math.min(cropRegion.y, height - 50));
    cropRegion.width = Math.max(50, Math.min(cropRegion.width, width - cropRegion.x));
    cropRegion.height = Math.max(50, Math.min(cropRegion.height, height - cropRegion.y));

    console.log("Smart crop result:", cropRegion, "Subjects:", cropData.subjects);

    return new Response(
      JSON.stringify({
        crop: cropRegion,
        confidence: cropData.confidence,
        subjects: cropData.subjects,
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
