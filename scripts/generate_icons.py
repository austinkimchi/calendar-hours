from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / "extension" / "icons"
root.mkdir(parents=True, exist_ok=True)

for size in (16, 48, 128):
    scale = 8
    canvas = size * scale
    image = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    p = lambda value: round(value * scale)
    draw.rounded_rectangle((0, 0, canvas - 1, canvas - 1), radius=p(size * 0.22), fill="#2463d6")
    margin = size * 0.19
    draw.ellipse((p(margin), p(margin), p(size - margin), p(size - margin)), fill="#ffffff")
    inner = size * 0.25
    draw.ellipse((p(inner), p(inner), p(size - inner), p(size - inner)), fill="#eaf2ff")
    center = p(size * 0.5)
    draw.line((center, center, p(size * 0.5), p(size * 0.32)), fill="#174ea6", width=p(size * 0.065), joint="curve")
    draw.line((center, center, p(size * 0.67), p(size * 0.55)), fill="#174ea6", width=p(size * 0.065), joint="curve")
    r = p(size * 0.047)
    draw.ellipse((center - r, center - r, center + r, center + r), fill="#174ea6")
    image.resize((size, size), Image.Resampling.LANCZOS).save(root / f"icon{size}.png")
