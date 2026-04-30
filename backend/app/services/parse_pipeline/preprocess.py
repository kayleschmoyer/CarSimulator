"""
OpenCV preprocessing: clean up floor plan image before sending to Claude Vision.
Removes noise, enhances line contrast, crops to drawing boundary.
"""
import cv2
import numpy as np
from PIL import Image


def preprocess_floor_plan(image_path: str, output_path: str) -> tuple[str, tuple[int, int]]:
    """
    Preprocess a floor plan image for Claude Vision analysis.
    Returns (output_path, (width_px, height_px)) of the processed image.
    """
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Cannot read image: {image_path}")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Adaptive thresholding handles uneven lighting (scanned plans, photos)
    binary = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=15,
        C=8
    )

    # Morphological close: fill small gaps in wall lines
    kernel = np.ones((2, 2), np.uint8)
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    # Find the main drawing bounding box (largest contour by area, excluding full image border)
    cropped = _crop_to_drawing(binary, img)

    h, w = cropped.shape[:2]
    cv2.imwrite(output_path, cropped)
    return output_path, (w, h)


def _crop_to_drawing(binary: np.ndarray, original: np.ndarray) -> np.ndarray:
    """
    Crop away title blocks and margins. Finds the largest dense region.
    Falls back to full image if detection is uncertain.
    """
    h, w = binary.shape[:2]

    # Invert so drawing lines are white on black, find contours
    inverted = cv2.bitwise_not(binary)
    contours, _ = cv2.findContours(inverted, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return original

    # Find bounding rect of all significant contours combined
    significant = [c for c in contours if cv2.contourArea(c) > (h * w * 0.001)]
    if not significant:
        return original

    all_points = np.concatenate(significant)
    x, y, cw, ch = cv2.boundingRect(all_points)

    # Only crop if the detected region is meaningfully smaller than the full image
    margin = 20
    if cw < w * 0.95 and ch < h * 0.95:
        x = max(0, x - margin)
        y = max(0, y - margin)
        cw = min(w - x, cw + margin * 2)
        ch = min(h - y, ch + margin * 2)
        return original[y:y+ch, x:x+cw]

    return original
