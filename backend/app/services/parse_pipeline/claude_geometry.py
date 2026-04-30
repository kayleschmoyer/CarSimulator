"""
Claude Vision Pass A: Extract geometric layout from floor plan.
Identifies walls, driving lanes, ramp regions, and perimeter openings.

This is the highest-leverage file in the parse pipeline.
Prompt engineering here directly determines simulation quality.
"""
import base64
import json
import re
from pathlib import Path

import anthropic

from app.config import settings


def _encode_image(image_path: str) -> str:
    with open(image_path, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8")


GEOMETRY_PROMPT = """You are an expert architectural drawing interpreter analyzing a parking garage floor plan.

Analyze this floor plan image and extract the geometric layout in JSON format.

The image uses pixel coordinates with origin at TOP-LEFT (x increases right, y increases down).

Extract the following in JSON with this exact structure:
{
  "scale": {
    "description": "what scale indicator you found (e.g. '1 inch = 20 feet' or scale bar)",
    "meters_per_pixel_estimate": <float, your best estimate of real-world meters per pixel>
  },
  "image_size": {"width_px": <int>, "height_px": <int>},
  "walls": [
    {
      "id": "w1",
      "points": [{"x": <int>, "y": <int>}, ...],
      "description": "brief description of which wall this is"
    }
  ],
  "driving_lanes": [
    {
      "id": "lane1",
      "polygon": [{"x": <int>, "y": <int>}, ...],
      "type": "straight|curved|intersection",
      "approximate_width_px": <int>,
      "one_way": true|false,
      "direction_degrees": <float or null, clockwise from north/up>
    }
  ],
  "ramp_regions": [
    {
      "id": "ramp1",
      "polygon": [{"x": <int>, "y": <int>}, ...],
      "direction": "up|down|bidirectional",
      "label_text": "text visible near the ramp e.g. RAMP UP",
      "connects_level_hint": "description of what level this leads to if visible"
    }
  ],
  "perimeter_openings": [
    {
      "id": "open1",
      "position": {"x": <int>, "y": <int>},
      "approximate_width_px": <int>,
      "type": "entry|exit|both",
      "description": "e.g. main vehicle entry, southeast corner"
    }
  ],
  "columns": [
    {
      "id": "col1",
      "position": {"x": <int>, "y": <int>},
      "approximate_size_px": <int>
    }
  ],
  "level_label": "the level number shown on the drawing e.g. LEVEL 02",
  "notes": "any important observations about the drawing"
}

IMPORTANT RULES:
- Provide pixel coordinates, not real-world measurements
- For walls: trace the CENTERLINE of each wall segment as a polyline
- For driving lanes: polygon should cover the DRIVEABLE SURFACE only (not parking stalls)
- For ramps: look for diagonal hatching + arrows + text like "RAMP UP" or "RAMP DN"
- For parking stalls: do NOT include them as driving lanes — they are perpendicular lines off the main lane
- Perimeter openings are gaps in the outer walls where vehicles enter/exit
- Only JSON in your response, no other text"""


GEOMETRY_PROMPT_SIMPLIFIED = """Analyze this parking garage floor plan. Extract a simplified layout.

Focus on: driveable lane areas (the corridors cars drive through), ramp locations, and exterior entry/exit openings.

Return ONLY valid JSON:
{
  "scale": {"meters_per_pixel_estimate": 0.05},
  "image_size": {"width_px": 1000, "height_px": 800},
  "walls": [],
  "driving_lanes": [
    {"id": "lane1", "polygon": [{"x":100,"y":100},{"x":900,"y":100},{"x":900,"y":200},{"x":100,"y":200}], "type":"straight", "approximate_width_px": 100, "one_way": false, "direction_degrees": null}
  ],
  "ramp_regions": [
    {"id": "ramp1", "polygon": [{"x":400,"y":300},{"x":600,"y":300},{"x":600,"y":500},{"x":400,"y":500}], "direction": "up", "label_text": "RAMP UP", "connects_level_hint": "level above"}
  ],
  "perimeter_openings": [
    {"id": "open1", "position": {"x": 500, "y": 50}, "approximate_width_px": 80, "type": "both", "description": "main entry"}
  ],
  "columns": [],
  "level_label": "LEVEL 02",
  "notes": "simplified extraction"
}"""


def extract_geometry(image_path: str) -> dict:
    """
    Send floor plan image to Claude for geometric layout extraction.
    Returns raw parsed JSON dict.
    """
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    image_data = _encode_image(image_path)

    message = client.messages.create(
        model=settings.claude_model,
        max_tokens=8192,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": image_data,
                        },
                    },
                    {
                        "type": "text",
                        "text": GEOMETRY_PROMPT,
                    }
                ],
            }
        ],
    )

    raw = message.content[0].text.strip()
    return _parse_json_response(raw)


def _parse_json_response(raw: str) -> dict:
    """Extract JSON from Claude's response, handling markdown code blocks."""
    # Strip markdown code fences if present
    clean = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()

    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        # Try to find the JSON object within the response
        match = re.search(r"\{.*\}", clean, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise ValueError(f"Claude returned non-JSON response: {raw[:200]}")
