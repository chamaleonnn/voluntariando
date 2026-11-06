"""Genera los cuatro tutoriales breves de la landing con la identidad de Voluntariando."""

from pathlib import Path
import math

import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "videos"
VIA_PATH = ROOT / "public" / "via-mecha.png"
WIDTH, HEIGHT, FPS, DURATION = 1280, 720, 30, 15


# Cada tutorial explica solamente acciones que existen en la aplicación.
TUTORIALS = {
    "crear-perfil": {
        "step": "01",
        "title": "Creá y completá tu perfil",
        "summary": "Tus datos ayudan a encontrar oportunidades con sentido para vos.",
        "scenes": [
            ("Mi espacio", "Abrí Editar perfil", ["Ubicación", "Intereses", "Habilidades"]),
            ("Privacidad", "Elegí quién puede encontrarte", ["Perfil visible", "Redes opcionales", "Tus datos bajo control"]),
            ("Compatibilidad", "Guardá para mejorar las recomendaciones", ["Causa", "Tareas", "Modalidad"]),
        ],
    },
    "recibir-recomendaciones": {
        "step": "02",
        "title": "Entendé tus recomendaciones",
        "summary": "El porcentaje combina cinco criterios claros y explicables.",
        "scenes": [
            ("Oportunidades", "Mayor compatibilidad primero", ["90 % · Apoyo escolar", "82 % · Huerta comunitaria", "76 % · Recreación"]),
            ("Detalle del resultado", "Cinco criterios, un solo porcentaje", ["Habilidades 30 %", "Intereses 20 %", "Ubicación 20 %", "Disponibilidad 15 %", "Modalidad 15 %"]),
            ("Preguntale a Vía", "Vía usa el mismo motor", ["Respondé preguntas breves", "Recibí una opción real", "Conocé por qué coincide"]),
        ],
    },
    "mostrar-interes": {
        "step": "03",
        "title": "Mostrá interés y vinculáte",
        "summary": "La organización responde y el contacto se habilita después del match.",
        "scenes": [
            ("Oportunidad", "Elegí Me interesa", ["Revisá tareas", "Mirá la compatibilidad", "Enviá tu solicitud"]),
            ("Organización", "La solicitud queda pendiente", ["Revisar perfil", "Aceptar", "Rechazar"]),
            ("Vinculación confirmada", "Ya pueden coordinar por correo", ["Estado confirmado", "Contacto habilitado", "Datos privados protegidos"]),
        ],
    },
    "sumar-experiencia": {
        "step": "04",
        "title": "Sumá una experiencia verificada",
        "summary": "Las tareas realizadas fortalecen tu trayectoria y futuras recomendaciones.",
        "scenes": [
            ("Participación", "La organización marca la actividad realizada", ["Persona vinculada", "Fecha registrada", "Tareas concretas"]),
            ("Habilidades observadas", "Se verifican solo evidencias reales", ["Hasta 3 habilidades", "Aspectos destacados", "Devolución revisable"]),
            ("Perfil actualizado", "Tu trayectoria mejora nuevas coincidencias", ["Experiencia visible", "Habilidades verificadas", "Recomendaciones actualizadas"]),
        ],
    },
}


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Usa una tipografía del sistema para que el resultado sea reproducible."""
    name = "Arial Bold.ttf" if bold else "Arial.ttf"
    return ImageFont.truetype(f"/System/Library/Fonts/Supplemental/{name}", size)


def rounded(draw: ImageDraw.ImageDraw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def ease(value: float) -> float:
    return 0.5 - 0.5 * math.cos(math.pi * max(0, min(1, value)))


def contain(image: Image.Image, max_width: int, max_height: int) -> Image.Image:
    copy = image.copy()
    copy.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
    return copy


def animated_via(max_width: int, max_height: int, phase: float, talking: bool = False) -> Image.Image:
    """Anima por capas el PNG original sin redibujar ni reemplazar a Vía."""
    via = contain(Image.open(VIA_PATH).convert("RGBA"), max_width, max_height)
    width, height = via.size
    overlay = Image.new("RGBA", via.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")

    # Pañuelito scout celeste: pequeño, sin insignias y adaptado al mismo PNG.
    scarf_x, scarf_y = width * .54, height * .455
    flutter = math.sin(phase * math.tau * 1.4) * width * .006
    draw.polygon([
        (scarf_x, scarf_y), (width * .59, height * .47),
        (width * .68, height * .445), (width * .70, height * .466),
        (width * .655, height * .493), (width * .57, height * .49),
    ], fill=(157, 207, 219, 232), outline=(100, 153, 165, 245))
    draw.polygon([
        (width * .605, height * .485), (width * .635, height * .49),
        (width * .615 + flutter, height * .565), (width * .59, height * .54),
    ], fill=(131, 189, 202, 238), outline=(100, 153, 165, 245))
    draw.polygon([
        (width * .63, height * .487), (width * .66, height * .482),
        (width * .675 - flutter, height * .55), (width * .645, height * .535),
    ], fill=(175, 216, 224, 238), outline=(100, 153, 165, 245))
    draw.ellipse((width * .612, height * .476, width * .653, height * .513), fill=(120, 174, 186, 245), outline=(90, 141, 152, 255))

    # Parpadeo muy breve para conservar la expresión original la mayor parte del tiempo.
    blink_phase = (phase * 3.7) % 1
    if .92 < blink_phase < .98:
        draw.ellipse((width * .585, height * .285, width * .72, height * .34), fill=(111, 141, 101, 225))
        draw.ellipse((width * .815, height * .205, width * .925, height * .25), fill=(111, 141, 101, 225))

    # Los videos no tienen audio: esto representa habla visual, no sincronización sonora.
    if talking:
        mouth_open = .5 + .5 * math.sin(phase * math.tau * 5)
        draw.arc((width * .70, height * (.425 - mouth_open * .004), width * .88, height * (.49 + mouth_open * .012)), 8, 170, fill=(66, 56, 42, 210), width=max(1, int(width * .009)))

    return Image.alpha_composite(via, overlay)


def wrap_text(draw: ImageDraw.ImageDraw, text: str, text_font, max_width: int) -> str:
    """Corta una frase sin permitir que invada a Vía ni los márgenes seguros."""
    lines, current = [], ""
    for word in text.split():
        candidate = f"{current} {word}".strip()
        if draw.textbbox((0, 0), candidate, font=text_font)[2] <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return "\n".join(lines)


def base_frame(progress: float) -> Image.Image:
    """Crea el fondo sobrio, líquido y legible de la identidad actual."""
    image = Image.new("RGB", (WIDTH, HEIGHT), "#f4f8f5")
    draw = ImageDraw.Draw(image, "RGBA")
    drift = math.sin(progress * math.tau) * 35
    draw.ellipse((-190 + drift, 340, 430 + drift, 970), fill=(90, 179, 144, 38))
    draw.ellipse((930 - drift, -280, 1510 - drift, 300), fill=(120, 111, 220, 34))
    draw.ellipse((420, -320 + drift, 980, 210 + drift), fill=(74, 167, 198, 20))
    rounded(draw, (30, 24, 1250, 92), 26, (255, 255, 255, 228), (219, 229, 222, 255))
    rounded(draw, (50, 40, 94, 84), 14, (220, 241, 232, 255))
    draw.text((64, 47), "V", font=font(24, True), fill="#24785a")
    draw.text((108, 48), "Voluntariando", font=font(25, True), fill="#20362e")
    draw.text((1035, 50), "GUÍA CON VÍA", font=font(17, True), fill="#527066")
    return image


def draw_progress(draw: ImageDraw.ImageDraw, active: int):
    for index in range(5):
        x = 52 + index * 236
        rounded(draw, (x, 112, x + 214, 119), 4, "#238563" if index <= active else "#dbe7df")


def draw_intro(frame: Image.Image, data, local: float):
    draw = ImageDraw.Draw(frame, "RGBA")
    via = animated_via(260, 238, local, talking=True)
    bounce = int(math.sin(local * math.pi * 2) * 6)
    frame.paste(via, (850, 200 + bounce), via)
    draw.text((96, 182), f"PASO {data['step']}", font=font(22, True), fill="#238563")
    title_font, summary_font = font(52, True), font(26)
    draw.multiline_text((96, 225), wrap_text(draw, data["title"], title_font, 740), font=title_font, fill="#19372c", spacing=6)
    draw.multiline_text((100, 378), wrap_text(draw, data["summary"], summary_font, 700), font=summary_font, fill="#50675f", spacing=8)
    rounded(draw, (96, 508, 610, 568), 22, (28, 48, 41, 230))
    draw.text((124, 524), "Tutorial breve · 15 segundos", font=font(20, True), fill="white")


def draw_scene(frame: Image.Image, data, scene_index: int, local: float):
    draw = ImageDraw.Draw(frame, "RGBA")
    title, subtitle, items = data["scenes"][scene_index]
    slide = int((1 - ease(min(local * 2.2, 1))) * 70)
    draw.text((78 + slide, 160), title.upper(), font=font(19, True), fill="#238563")
    draw.text((78 + slide, 196), subtitle, font=font(39, True), fill="#19372c")
    # Panel que representa el dato o acción real explicado en este tramo.
    rounded(draw, (76 + slide, 278, 900 + slide, 578), 28, (255, 255, 255, 238), (211, 225, 216, 255), 2)
    for index, item in enumerate(items):
        y = 308 + index * (220 // max(1, len(items)))
        rounded(draw, (110 + slide, y, 866 + slide, y + 54), 18, "#eef5f0")
        rounded(draw, (126 + slide, y + 13, 154 + slide, y + 41), 10, "#d5eee3")
        draw.text((134 + slide, y + 14), "✓", font=font(17, True), fill="#238563")
        draw.text((174 + slide, y + 13), item, font=font(22, index == 0), fill="#29483d")
    via = animated_via(205, 190, local + scene_index, talking=True)
    bob = int(math.sin(local * math.pi * 3) * 5)
    frame.paste(via, (994, 350 + bob), via)
    draw.text((1000, 540), f"{scene_index + 1} / 3", font=font(18, True), fill="#527066")


def draw_outro(frame: Image.Image, data, local: float):
    draw = ImageDraw.Draw(frame, "RGBA")
    via = animated_via(190, 178, local, talking=False)
    frame.paste(via, (546, 152), via)
    draw.text((WIDTH // 2, 354), "¡Listo!", font=font(48, True), fill="#19372c", anchor="ma")
    draw.text((WIDTH // 2, 423), "Podés repetir este recorrido desde el botón ?", font=font(25), fill="#50675f", anchor="ma")
    rounded(draw, (430, 492, 850, 552), 22, "#238563")
    draw.text((WIDTH // 2, 508), "Volver a Voluntariando", font=font(21, True), fill="white", anchor="ma")


def render(name: str, data: dict):
    """Renderiza un MP4 H.264 y su poster con el mismo primer cuadro."""
    target = OUTPUT / f"{name}.mp4"
    poster = OUTPUT / f"{name}.png"
    writer = imageio.get_writer(target, fps=FPS, codec="libx264", quality=8, pixelformat="yuv420p")
    poster_frame = None
    for number in range(FPS * DURATION):
        second = number / FPS
        frame = base_frame(number / (FPS * DURATION))
        draw = ImageDraw.Draw(frame, "RGBA")
        if second < 2.5:
            draw_progress(draw, 0)
            draw_intro(frame, data, second / 2.5)
        elif second < 12.5:
            scene_float = (second - 2.5) / (10 / 3)
            scene = min(2, int(scene_float))
            draw_progress(draw, scene + 1)
            draw_scene(frame, data, scene, scene_float - scene)
        else:
            draw_progress(draw, 4)
            draw_outro(frame, data, (second - 12.5) / 2.5)
        if poster_frame is None:
            poster_frame = frame.copy()
        writer.append_data(np.asarray(frame))
    writer.close()
    poster_frame.save(poster, optimize=True)
    print(f"Generado: {target.name}")


if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for tutorial_name, tutorial_data in TUTORIALS.items():
        render(tutorial_name, tutorial_data)
