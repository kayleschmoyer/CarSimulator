"""
Claude Vision Pass B: Extract semantic features from floor plan.
Identifies cameras, signs, text labels, stairwells, elevators.
"""
import base64
import json
import re

import anthropic

from app.config import settings


def _encode_image(image_path: str) -> str:
    with open(image_path, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8")


FEATURES_PROMPT = """You are analyzing a parking garage floor plan to identify cameras, signs, and other safety features.

This is the SAME image as before but now focus ONLY on:
1. Security camera symbols (circles with a line indicating lens, or "CAM"/"CCTV" labels)
2. Signage (EXIT signs, directional signs, speed limit signs, height clearance signs)
3. Emergency equipment locations
4. Stairwell locations
5. Elevator locations

Return ONLY valid JSON:
{
  "cameras": [
    {
      "id": "cam1",
      "position": {"x": <int>, "y": <int>},
      "facing_direction_degrees": <float or null>,
      "coverage_angle_degrees": <float, default 90>,
      "elevation_hint": "ceiling|wall|unknown",
      "confidence": <float 0-1>,
      "symbol_description": "what you saw that led you to identify this as a camera"
    }
  ],
  "signs": [
    {
      "id": "sign1",
      "position": {"x": <int>, "y": <int>},
      "type": "exit|directional|level_id|speed_limit|height_clearance|pedestrian|unknown",
      "text": "exact text if readable",
      "confidence": <float 0-1>,
      "description": "what you saw"
    }
  ],
  "stairwells": [
    {
      "id": "stair1",
      "position": {"x": <int>, "y": <int>},
      "label": "text label e.g. STAIR A"
    }
  ],
  "elevators": [
    {
      "id": "elev1",
      "position": {"x": <int>, "y": <int>},
      "label": "text label"
    }
  ],
  "notes": "any other relevant observations"
}

CONFIDENCE GUIDE:
- 0.9+: Clear symbol or explicit label visible
- 0.7-0.9: Symbol present but partially obscured
- 0.5-0.7: Inferred from context (e.g., typical camera placement near entry)
- <0.5: Very uncertain, do not include

Only include cameras and signs you can reasonably identify. Better to miss one than to hallucinate."""


def extract_features(image_path: str) -> dict:
    """
    Send floor plan image to Claude for camera/sign feature extraction.
    Returns raw parsed JSON dict.
    """
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    image_data = _encode_image(image_path)

    message = client.messages.create(
        model=settings.claude_model,
        max_tokens=4096,
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
                        "text": FEATURES_PROMPT,
                    }
                ],
            }
        ],
    )

    raw = message.content[0].text.strip()
    return _parse_json_response(raw)


def _parse_json_response(raw: str) -> dict:
    clean = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", clean, re.DOTALL)
        if match:
            return json.loads(match.group())
        return {"cameras": [], "signs": [], "stairwells": [], "elevators": [], "notes": "parse failed"}
