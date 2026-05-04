"""
Tesseract OCR: extract text labels and their positions from floor plan.
Used to reliably find RAMP UP/DN, EXIT, PEDESTRIAN PATHWAY, etc.
"""
import re

try:
    import pytesseract
    from PIL import Image
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False


# Labels that indicate specific feature types
RAMP_PATTERNS = re.compile(r"RAMP\s*(UP|DN|DOWN|DWN)", re.IGNORECASE)
EXIT_PATTERNS = re.compile(r"\bEXIT\b", re.IGNORECASE)
CAMERA_PATTERNS = re.compile(r"\b(CAM|CCTV|CAMERA|SEC\s*CAM)\b", re.IGNORECASE)
PEDESTRIAN_PATTERNS = re.compile(r"PEDESTRIAN", re.IGNORECASE)
STAIR_PATTERNS = re.compile(r"STAIR\s*[A-Z]?", re.IGNORECASE)
ELEV_PATTERNS = re.compile(r"ELEV(ATOR)?\s*\d?", re.IGNORECASE)


def extract_text_labels(image_path: str) -> list[dict]:
    """
    Run OCR on floor plan and return list of detected text labels with positions.
    Each result: {text, x, y, width, height, confidence, feature_type}
    Returns empty list if Tesseract binary is not installed — OCR is optional.
    """
    if not OCR_AVAILABLE:
        return []

    try:
        img = Image.open(image_path)
        data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    except Exception:
        # Tesseract binary not in PATH — skip OCR, Claude vision handles text detection
        return []

    results = []
    for i, text in enumerate(data["text"]):
        text = text.strip()
        if not text or len(text) < 2:
            continue

        conf = int(data["conf"][i])
        if conf < 40:  # skip very low-confidence OCR results
            continue

        x = data["left"][i]
        y = data["top"][i]
        w = data["width"][i]
        h = data["height"][i]

        feature_type = _classify_label(text)

        results.append({
            "text": text,
            "x": x + w // 2,  # center x
            "y": y + h // 2,  # center y
            "width": w,
            "height": h,
            "ocr_confidence": conf / 100.0,
            "feature_type": feature_type,
        })

    return results


def _classify_label(text: str) -> str:
    if RAMP_PATTERNS.search(text):
        direction = "up" if re.search(r"\bUP\b", text, re.IGNORECASE) else "down"
        return f"ramp_{direction}"
    if EXIT_PATTERNS.search(text):
        return "exit_sign"
    if CAMERA_PATTERNS.search(text):
        return "camera"
    if PEDESTRIAN_PATTERNS.search(text):
        return "pedestrian_path"
    if STAIR_PATTERNS.search(text):
        return "stairwell"
    if ELEV_PATTERNS.search(text):
        return "elevator"
    return "label"
