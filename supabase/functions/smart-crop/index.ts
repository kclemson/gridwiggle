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

interface SubjectBox {
  kind: "person" | "pet";
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

/**
 * Mirror of `visionWorker.calculateOptimalCrop` — keep in sync.
 * Inputs are pixel-space boxes already filtered/selected; output is the
 * union padded by 10% of min(W,H), clamped to image bounds.
 */
function unionWithPadding(
  boxes: { x: number; y: number; width: number; height: number }[],
  imgW: number,
  imgH: number,
): CropRegion {
  let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  const padding = Math.min(imgW, imgH) * 0.1;
  const x = Math.max(0, minX - padding);
  const y = Math.max(0, minY - padding);
  const right = Math.min(imgW, maxX + padding);
  const bottom = Math.min(imgH, maxY + padding);
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(right - x),
    height: Math.round(bottom - y),
  };
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
            content: `You are an object detector. Detect every visible HUMAN FACE and every PET (cat or dog) in the image.

RULES:
- Only count a human if a FACE is visible. A bare arm, leg, torso, hand, or back-of-head without a visible face does NOT count.
- For each detected human, return a bounding box around the ENTIRE VISIBLE BODY (head to feet, including any extended arms or legs) — NOT just the face. The visible face is only the gating rule for whether the person counts; the box itself must cover the whole body. For each pet, box the entire visible animal. Cropping/composition is handled by another system; your only job is to locate subjects.
- Return one entry per subject. If two faces are visible, return two entries. If a face and a dog are visible, return both.
- If no faces and no pets are visible, return an empty subjects array.

COORDINATE FORMAT — CRITICAL:
All of x, y, width, height MUST be normalized floats between 0.0 and 1.0 (fractions of image width/height). DO NOT use percentages (0–100). DO NOT use pixel values. DO NOT use the 0–1000 box format.

Example output for an image with one standing person on the left and a dog on the right (both head-to-feet):
{"subjects":[{"kind":"person","x":0.08,"y":0.12,"width":0.30,"height":0.82,"confidence":0.97},{"kind":"pet","x":0.60,"y":0.45,"width":0.28,"height":0.45,"confidence":0.91}],"description":"woman and dog"}`
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
                text: `Detect every person (face must be visible to count) and every pet (cat/dog) in this ${width}x${height} image. For each person return a WHOLE-BODY box (head to feet); for each pet box the whole animal. Use normalized 0.0–1.0 coordinates (NOT percentages, NOT pixels). Return ONLY the JSON object.`
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
                subjects: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      kind: { type: "string", enum: ["person", "pet"] },
                      x: { type: "number", minimum: 0, maximum: 1 },
                      y: { type: "number", minimum: 0, maximum: 1 },
                      width: { type: "number", minimum: 0, maximum: 1 },
                      height: { type: "number", minimum: 0, maximum: 1 },
                      confidence: { type: "number", minimum: 0, maximum: 1 },
                    },
                    required: ["kind", "x", "y", "width", "height", "confidence"],
                  },
                },
                description: { type: "string" },
              },
              required: ["subjects", "description"],
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
    let parsed: { subjects?: SubjectBox[]; description?: string };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      parsed = { subjects: [], description: "Unable to analyze" };
    }

    const rawSubjects: SubjectBox[] = Array.isArray(parsed.subjects) ? parsed.subjects : [];

    // Defensive coordinate-space normalization (Gemini sometimes drifts to
    // percent or 0–1000 box format despite schema bounds).
    let maxVal = 0;
    for (const s of rawSubjects) {
      maxVal = Math.max(maxVal, Number(s.x) || 0, Number(s.y) || 0, Number(s.width) || 0, Number(s.height) || 0);
    }
    let divisor = 1;
    let coordSpace = "normalized-0-1";
    if (maxVal > 100) { divisor = 1000; coordSpace = "normalized-0-1000"; }
    else if (maxVal > 1.5) { divisor = 100; coordSpace = "percent-0-100"; }

    // Filter by confidence and bucket by kind (faces preferred, then pets).
    const kept = rawSubjects.filter((s) => Number(s.confidence) > 0.4);
    const people = kept.filter((s) => s.kind === "person");
    const pets = kept.filter((s) => s.kind === "pet");
    const chosen = people.length > 0 ? people : pets;
    const chosenKind = people.length > 0 ? "person" : pets.length > 0 ? "pet" : "none";

    console.log(
      `Detections: ${rawSubjects.length} raw, ${kept.length} kept (conf>0.4). ` +
      `Coord: ${coordSpace} (max=${maxVal}). Chosen=${chosenKind} (${chosen.length}). ` +
      `Description: ${parsed.description ?? ""}`,
    );

    if (chosen.length === 0) {
      console.log("No people/pets detected → skipCrop=true");
      return new Response(
        JSON.stringify({
          crop: { x: 0, y: 0, width, height },
          confidence: 0,
          subjects: parsed.description ?? "No people or pets detected",
          skipCrop: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert normalized boxes → pixel boxes, then union + 10% padding.
    const pixelBoxes = chosen.map((s) => ({
      x: (Number(s.x) / divisor) * width,
      y: (Number(s.y) / divisor) * height,
      width: (Number(s.width) / divisor) * width,
      height: (Number(s.height) / divisor) * height,
    }));
    let cropRegion = unionWithPadding(pixelBoxes, width, height);

    // Final safety clamp + min-size enforcement.
    cropRegion.x = Math.max(0, Math.min(cropRegion.x, width - 50));
    cropRegion.y = Math.max(0, Math.min(cropRegion.y, height - 50));
    cropRegion.width = Math.max(50, Math.min(cropRegion.width, width - cropRegion.x));
    cropRegion.height = Math.max(50, Math.min(cropRegion.height, height - cropRegion.y));

    // Extreme-aspect safety net: should rarely fire now that we control the
    // geometry, but keeps us safe if a single bogus huge detection slips through.
    const aspectRatio = cropRegion.width / cropRegion.height;
    const minDimension = Math.min(width, height) * 0.2;
    if (cropRegion.width < minDimension || cropRegion.height < minDimension ||
        aspectRatio > 3 || aspectRatio < 0.33) {
      console.log("Extreme crop after union, falling back to 80% center. Was:", cropRegion, "AR:", aspectRatio);
      cropRegion = {
        x: Math.round(width * 0.1),
        y: Math.round(height * 0.1),
        width: Math.round(width * 0.8),
        height: Math.round(height * 0.8),
      };
    }

    const maxConfidence = Math.max(...chosen.map((s) => Number(s.confidence) || 0));
    console.log("Smart crop result:", cropRegion, "kind:", chosenKind, "subjects:", parsed.description);

    return new Response(
      JSON.stringify({
        crop: cropRegion,
        confidence: maxConfidence,
        subjects: parsed.description ?? chosenKind,
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
