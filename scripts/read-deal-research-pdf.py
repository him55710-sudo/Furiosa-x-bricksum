"""Read-only PDF word positions. No task answers or company-specific values."""
import hashlib
import json
import sys
from pathlib import Path
import fitz

raw = Path(sys.argv[1]).read_bytes()
number = int(sys.argv[2])
with fitz.open(stream=raw, filetype="pdf") as document:
    if not 1 <= number <= len(document):
        raise ValueError("PDF_PAGE_OUT_OF_RANGE")
    page = document[number - 1]
    print(json.dumps({
        "sha256": hashlib.sha256(raw).hexdigest(), "page": number,
        "width": page.rect.width, "height": page.rect.height,
        "parser": "PyMuPDF " + fitz.VersionBind,
        "words": [{"id": f"p{number}-w{i}", "text": w[4],
                   "box": [round(x, 3) for x in w[:4]]}
                  for i, w in enumerate(page.get_text("words"))]
    }))
