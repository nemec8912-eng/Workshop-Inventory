from pathlib import Path
import cairosvg

root = Path(__file__).resolve().parents[1]
source = root / "public" / "favicon.svg"
for size in (192, 512):
    cairosvg.svg2png(url=str(source), write_to=str(root / "public" / f"icon-{size}.png"), output_width=size, output_height=size)
cairosvg.svg2png(url=str(source), write_to=str(root / "public" / "apple-touch-icon.png"), output_width=180, output_height=180)
print("Generated consistent application icons at 192px, 512px and 180px")
