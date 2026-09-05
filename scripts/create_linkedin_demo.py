"""Create a 10-second non-AI motion graphic for React FormKit's LinkedIn post."""

from pathlib import Path

import imageio.v2 as imageio
from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT, FPS, SECONDS = 1280, 720, 12, 10
OUT = Path("marketing/react-formkit-v1.1-demo.mp4")
FONT = "C:/Windows/Fonts/segoeui.ttf"
FONT_BOLD = "C:/Windows/Fonts/segoeuib.ttf"


def font(size: int, bold: bool = False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT, size)


def text(draw, xy, value, size, color, bold=False):
    draw.text(xy, value, font=font(size, bold), fill=color)


def box(draw, rect, fill, outline=None, radius=20, width=2):
    draw.rounded_rectangle(rect, radius, fill=fill, outline=outline, width=width)


def field(draw, y, label, value, active=False, error=None):
    text(draw, (150, y), label, 20, "#d7e4ff", True)
    stroke = "#ff5b73" if error else ("#37d7ff" if active else "#334b73")
    box(draw, (150, y + 32, 720, y + 90), "#111d33", stroke, 12, 3 if active or error else 2)
    text(draw, (170, y + 47), value, 20, "#f3f7ff")
    if error:
        text(draw, (150, y + 100), error, 16, "#ff8192")


def frame(index: int):
    t = index / FPS
    image = Image.new("RGB", (WIDTH, HEIGHT), "#071326")
    draw = ImageDraw.Draw(image)
    text(draw, (70, 54), "React FormKit", 42, "#ffffff", True)
    text(draw, (74, 108), "Build forms with less boilerplate.", 23, "#9eb4d8")
    box(draw, (85, 165, 785, 640), "#0c1a31", "#29466d", 28, 2)

    if t < 1.3:
        headline, detail = "A form that feels simple.", "Type-safe fields. No UI framework required."
        email, password, terms, error = "", "", False, None
    elif t < 3.3:
        headline, detail = "Register fields in one line.", 'form.register("email")'
        email, password, terms, error = "ahmad@example.com", "", False, None
    elif t < 5.6:
        headline, detail = "Validation rules are built in.", "Required • Pattern • Min length"
        email, password, terms, error = "bad-email", "short", False, "Enter a valid email"
    elif t < 7.5:
        headline, detail = "Errors guide users to the right field.", "shouldFocusError: true"
        email, password, terms, error = "bad-email", "short", False, "Enter a valid email"
    else:
        headline, detail = "Ready to submit.", "Values • Validation • Submission"
        email, password, terms, error = "ahmad@example.com", "••••••••", True, None

    field(draw, 215, "Email", email, active=5.6 <= t < 7.5, error=error)
    field(draw, 350, "Password", password, active=3.3 <= t < 5.6)
    box(draw, (150, 485, 180, 515), "#2463eb" if terms else "#111d33", "#53d7ff", 6, 2)
    if terms:
        text(draw, (155, 483), "✓", 23, "#ffffff", True)
    text(draw, (195, 486), "I agree to the terms", 18, "#d7e4ff")
    box(draw, (150, 545, 720, 602), "#20bfe7", None, 12)
    text(draw, (350, 558), "Create account", 19, "#06111f", True)

    box(draw, (850, 185, 1195, 585), "#0c1a31", "#29466d", 28, 2)
    text(draw, (895, 235), headline, 30, "#ffffff", True)
    text(draw, (895, 320), detail, 20, "#73dfff")
    if 3.3 <= t < 7.5:
        text(draw, (895, 405), "Validation", 24, "#ba8cff", True)
        text(draw, (895, 447), "✓ required", 19, "#d7e4ff")
        text(draw, (895, 482), "✓ pattern", 19, "#d7e4ff")
        text(draw, (895, 517), "✓ custom rules", 19, "#d7e4ff")
    elif t >= 7.5:
        text(draw, (895, 430), "✓ Valid", 30, "#57e38a", True)
        text(draw, (895, 480), "handleSubmit()", 22, "#d7e4ff")
    else:
        text(draw, (895, 430), "useSmartForm()", 29, "#ba8cff", True)

    text(draw, (70, 680), "@ahmad231/react-formkit  •  npm install @ahmad231/react-formkit", 16, "#6e86ac")
    return image


def main():
    OUT.parent.mkdir(exist_ok=True)
    with imageio.get_writer(OUT, fps=FPS, codec="libx264", quality=8, macro_block_size=None) as writer:
        for index in range(FPS * SECONDS):
            writer.append_data(__import__("numpy").asarray(frame(index)))
    print(OUT.resolve())


if __name__ == "__main__":
    main()
