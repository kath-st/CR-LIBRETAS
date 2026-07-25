from __future__ import annotations

import argparse
import json
from pathlib import Path

import fitz
from pypdf import PdfReader


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Valida páginas A4 y renderiza muestras visuales."
    )
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--expected-pages", type=int, required=True)
    parser.add_argument(
        "--render-dir",
        type=Path,
        default=Path("output/pdf/validacion-fase-6"),
    )
    args = parser.parse_args()

    reader = PdfReader(args.pdf)
    if len(reader.pages) != args.expected_pages:
        raise ValueError(
            f"Se esperaban {args.expected_pages} páginas y se encontraron "
            f"{len(reader.pages)}."
        )

    expected_width = 595.28
    expected_height = 841.89
    page_details: list[dict[str, object]] = []
    for index, page in enumerate(reader.pages):
        width = float(page.mediabox.width)
        height = float(page.mediabox.height)
        if abs(width - expected_width) > 1 or abs(height - expected_height) > 1:
            raise ValueError(
                f"La página {index + 1} no es A4: {width:.2f} x {height:.2f} pt."
            )
        text = (page.extract_text() or "").strip()
        compact_text = "".join(text.split())
        if "BOLETADE NOTAS".replace(" ", "") not in compact_text:
            raise ValueError(
                f"La página {index + 1} no contiene el encabezado de boleta."
            )
        page_details.append(
            {
                "page": index + 1,
                "width_pt": round(width, 2),
                "height_pt": round(height, 2),
                "text_characters": len(text),
            }
        )

    args.render_dir.mkdir(parents=True, exist_ok=True)
    document = fitz.open(args.pdf)
    sample_indexes = sorted({0, len(document) // 2, len(document) - 1})
    rendered: list[str] = []
    for index in sample_indexes:
        page = document[index]
        pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        output = args.render_dir / f"pagina-{index + 1:03d}.png"
        pixmap.save(output)
        rendered.append(str(output))

    print(
        json.dumps(
            {
                "file": str(args.pdf),
                "pages": len(reader.pages),
                "a4_pages": len(page_details),
                "rendered_samples": rendered,
                "minimum_text_characters": min(
                    item["text_characters"] for item in page_details
                ),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
