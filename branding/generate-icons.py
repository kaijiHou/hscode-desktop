"""Mechanical conversion of the supplied H PNG; Pillow is a build tool, not a runtime dependency."""
import base64
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

root = Path(__file__).resolve().parent.parent
source_path = root / "branding/hscode-logo-source.png"
source = Image.open(source_path).convert("RGBA")
sizes = (16, 24, 32, 48, 64, 128, 256)


def icon(size):
    # Only small derivatives trim the decorative border to keep H legible.
    image = source
    if size <= 32:
        width, height = source.size
        image = source.crop((width * .20, height * .17, width * .80, height * .81))
    return ImageOps.contain(image, (size, size), Image.Resampling.LANCZOS).resize(
        (size, size), Image.Resampling.LANCZOS
    )


def save_ico(path):
    icon(256).save(path, format="ICO", sizes=[(s, s) for s in sizes],
                   append_images=[icon(s) for s in sizes[:-1]])


outputs = []
for channel in ("dev", "beta", "prod"):
    directory = root / "packages/desktop/icons" / channel
    for path in directory.glob("*.png"):
        with Image.open(path) as old:
            dimensions = old.size
        ImageOps.fit(source, dimensions, method=Image.Resampling.LANCZOS).save(path)
        outputs.append(str(path.relative_to(root)))
    save_ico(directory / "icon.ico")
    source.resize((1024, 1024), Image.Resampling.LANCZOS).save(directory / "icon.icns")
    outputs.extend(str((directory / name).relative_to(root)) for name in ("icon.ico", "icon.icns"))

assets = root / "packages/ui/src/assets/branding"
source.resize((512, 512), Image.Resampling.LANCZOS).save(assets / "hscode.png")
wordmark = Image.new("RGBA", (1440, 258))
wordmark.alpha_composite(source.resize((258, 258), Image.Resampling.LANCZOS), (0, 0))
font = ImageFont.truetype("C:/Windows/Fonts/seguisb.ttf", 136)
text = "HSCode Preview"
draw = ImageDraw.Draw(wordmark)
bounds = draw.textbbox((0, 0), text, font=font)
text_image = Image.new("RGBA", (bounds[2] - bounds[0], bounds[3] - bounds[1]))
ImageDraw.Draw(text_image).text((-bounds[0], -bounds[1]), text, font=font, fill=(34, 151, 238, 255))
text_image = ImageOps.contain(text_image, (1125, 172), Image.Resampling.LANCZOS)
wordmark.alpha_composite(text_image, (298, (258 - text_image.height) // 2))
wordmark.save(assets / "hscode-wordmark.png")

favicons = root / "packages/ui/src/assets/favicon"
for suffix in ("", "-v3"):
    icon(96).save(favicons / f"favicon-96x96{suffix}.png")
    icon(180).save(favicons / f"apple-touch-icon{suffix}.png")
    save_ico(favicons / f"favicon{suffix}.ico")
    png = base64.b64encode((assets / "hscode.png").read_bytes()).decode()
    (favicons / f"favicon{suffix}.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
        f'<image width="512" height="512" href="data:image/png;base64,{png}"/></svg>\n',
        encoding="utf-8", newline="\n",
    )
for size in (192, 512):
    icon(size).save(favicons / f"web-app-manifest-{size}x{size}.png")

evidence = root / ".local/logs"
evidence.mkdir(parents=True, exist_ok=True)
sheet = Image.new("RGB", (550, 130), "#eeeeee")
draw = ImageDraw.Draw(sheet)
for index, size in enumerate((16, 24, 32, 48, 64)):
    image = icon(size)
    x = index * 110 + (110 - size) // 2
    sheet.paste(image, (x, 14), image)
    draw.text((index * 110 + 30, 95), f"{size} px", fill="black")
sheet.save(evidence / "small-icons.png")
with Image.open(root / "packages/desktop/icons/dev/icon.ico") as ico:
    actual_sizes = sorted(ico.ico.sizes())
assert actual_sizes == [(s, s) for s in sizes], actual_sizes
report = {
    "source": str(source_path), "source_dimensions": source.size,
    "source_sha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
    "ico_dimensions": actual_sizes, "wordmark_dimensions": wordmark.size,
    "desktop_outputs": outputs,
}
(evidence / "icons.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({key: value for key, value in report.items() if key != "desktop_outputs"}))
