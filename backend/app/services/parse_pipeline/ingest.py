"""
Ingest uploaded files and convert to a clean high-res PNG for processing.
"""
import os
import uuid
from pathlib import Path

import numpy as np
from PIL import Image

try:
    from pdf2image import convert_from_path
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False


SUPPORTED_EXTENSIONS = {".pdf", ".png", ".bmp", ".jpg", ".jpeg", ".tiff", ".tif"}


def ingest_file(file_path: str, output_dir: str) -> str:
    """
    Convert uploaded file to a clean PNG. Returns path to the output PNG.
    """
    path = Path(file_path)
    ext = path.suffix.lower()

    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: {ext}")

    out_name = f"{uuid.uuid4()}.png"
    out_path = os.path.join(output_dir, out_name)

    if ext == ".pdf":
        if not PDF_SUPPORT:
            raise RuntimeError("pdf2image not available; install poppler-utils")
        pages = convert_from_path(file_path, dpi=300)
        if not pages:
            raise ValueError("PDF has no pages")
        # Use first page (caller should split multi-page PDFs per level)
        pages[0].save(out_path, "PNG")
    else:
        img = Image.open(file_path)
        # Convert to RGB (handles BMP, palette-mode, RGBA, etc.)
        img = img.convert("RGB")
        img.save(out_path, "PNG")

    return out_path
