import Foundation
import AppKit

struct Scene {
    let title: String
    let detail: String
    let tag: String
}

struct VideoSpec {
    let slug: String
    let number: Int
    let title: String
    let summary: String
    let scenes: [Scene]
}

let videos = [
    VideoSpec(
        slug: "crear-perfil",
        number: 1,
        title: "Creá tu perfil",
        summary: "Tus datos permiten encontrar experiencias que tengan sentido para vos.",
        scenes: [
            Scene(title: "Ingresá con Google", detail: "Accedé de forma segura con tu cuenta.", tag: "ACCESO"),
            Scene(title: "Elegí Voluntario", detail: "Seleccioná el camino que querés recorrer.", tag: "ROL"),
            Scene(title: "Contanos sobre vos", detail: "Sumá intereses, habilidades y ubicación.", tag: "PERFIL"),
            Scene(title: "Controlá tu privacidad", detail: "Decidí qué información pueden ver los demás.", tag: "PRIVACIDAD")
        ]
    ),
    VideoSpec(
        slug: "recibir-recomendaciones",
        number: 2,
        title: "Recibí recomendaciones",
        summary: "El sistema combina tu trayectoria con preguntas breves para orientarte.",
        scenes: [
            Scene(title: "Leemos tu trayectoria", detail: "Consideramos experiencias y habilidades verificadas.", tag: "MÉTRICAS"),
            Scene(title: "Respondé dos preguntas", detail: "Indicá qué buscás y qué modalidad preferís.", tag: "ORIENTACIÓN"),
            Scene(title: "Comparamos oportunidades", detail: "Analizamos tareas, habilidades, intereses y lugar.", tag: "ANÁLISIS"),
            Scene(title: "Entendé el resultado", detail: "Cada recomendación explica por qué aparece para vos.", tag: "COMPATIBILIDAD")
        ]
    ),
    VideoSpec(
        slug: "mostrar-interes",
        number: 3,
        title: "Mostrá interés",
        summary: "Postularte inicia el contacto sin compartir información sensible de más.",
        scenes: [
            Scene(title: "Abrí una oportunidad", detail: "Revisá la propuesta que llamó tu atención.", tag: "EXPLORAR"),
            Scene(title: "Conocé todos los detalles", detail: "Mirá tareas, fecha, modalidad y habilidades.", tag: "INFORMACIÓN"),
            Scene(title: "Marcá “Me interesa”", detail: "La organización recibe tu solicitud en la app.", tag: "SOLICITUD"),
            Scene(title: "Esperá la respuesta", detail: "La organización puede aceptar o rechazar el vínculo.", tag: "MATCH")
        ]
    ),
    VideoSpec(
        slug: "sumar-experiencia",
        number: 4,
        title: "Sumá experiencia",
        summary: "Cada participación validada mejora tu trayectoria y futuras recomendaciones.",
        scenes: [
            Scene(title: "La actividad se completa", detail: "La organización marca la participación como realizada.", tag: "EXPERIENCIA"),
            Scene(title: "Se registran las tareas", detail: "La devolución detalla lo que hiciste realmente.", tag: "DEVOLUCIÓN"),
            Scene(title: "Recibís hasta 3 medallas", detail: "Las habilidades observadas suman niveles dinámicos.", tag: "HABILIDADES"),
            Scene(title: "El perfil aprende", detail: "La validación actualiza tu perfil y las recomendaciones.", tag: "NUEVO PERFIL")
        ]
    )
]

let width = 960
let height = 540
let fps: Int32 = 30
let introDuration = 2.0
let sceneDuration = 3.0
let outroDuration = 1.0

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let outputDirectory = root.appendingPathComponent("public/videos", isDirectory: true)
try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

func color(_ hex: UInt32, alpha: CGFloat = 1) -> NSColor {
    NSColor(
        red: CGFloat((hex >> 16) & 0xff) / 255,
        green: CGFloat((hex >> 8) & 0xff) / 255,
        blue: CGFloat(hex & 0xff) / 255,
        alpha: alpha
    )
}

func roundedRect(_ rect: CGRect, radius: CGFloat, fill: NSColor, stroke: NSColor? = nil, width: CGFloat = 1) {
    let path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
    fill.setFill()
    path.fill()
    if let stroke {
        stroke.setStroke()
        path.lineWidth = width
        path.stroke()
    }
}

func drawText(_ text: String, in rect: CGRect, size: CGFloat, weight: NSFont.Weight, color: NSColor, alignment: NSTextAlignment = .left) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = alignment
    paragraph.lineBreakMode = .byWordWrapping
    paragraph.minimumLineHeight = size * 1.12
    paragraph.maximumLineHeight = size * 1.22
    let attributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: size, weight: weight),
        .foregroundColor: color,
        .paragraphStyle: paragraph
    ]
    NSString(string: text).draw(with: rect, options: [.usesLineFragmentOrigin, .usesFontLeading], attributes: attributes)
}

func ease(_ value: Double) -> CGFloat {
    let t = max(0, min(1, value))
    return CGFloat(1 - pow(1 - t, 3))
}

func renderFrame(_ context: CGContext, spec: VideoSpec, time: Double, duration: Double) {
    let graphics = NSGraphicsContext(cgContext: context, flipped: true)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = graphics

    let canvas = CGRect(x: 0, y: 0, width: width, height: height)
    NSGradient(colors: [color(0xF5F4EF), color(0xE8F2ED), color(0xEEE9F7)])!.draw(in: canvas, angle: -25)

    color(0x7BC5AA, alpha: 0.2).setFill()
    NSBezierPath(ovalIn: CGRect(x: -90 + sin(time * 0.5) * 20, y: 250, width: 330, height: 330)).fill()
    color(0x9287C6, alpha: 0.16).setFill()
    NSBezierPath(ovalIn: CGRect(x: 740, y: -100 + cos(time * 0.45) * 20, width: 300, height: 300)).fill()

    // Barra superior inspirada en la interfaz real.
    roundedRect(CGRect(x: 30, y: 24, width: 900, height: 58), radius: 20, fill: color(0xFFFFFF, alpha: 0.76), stroke: color(0xFFFFFF, alpha: 0.92))
    roundedRect(CGRect(x: 47, y: 34, width: 38, height: 38), radius: 13, fill: color(0xDDF0E5))
    drawText("R", in: CGRect(x: 47, y: 40, width: 38, height: 24), size: 18, weight: .bold, color: color(0x176B57), alignment: .center)
    drawText("VoluntarIAndo", in: CGRect(x: 98, y: 43, width: 180, height: 24), size: 14, weight: .bold, color: color(0x24483F))
    drawText("INICIO     OPORTUNIDADES     MI ESPACIO", in: CGRect(x: 410, y: 44, width: 410, height: 22), size: 11, weight: .semibold, color: color(0x667A72), alignment: .center)

    let overallProgress = CGFloat(time / duration)
    roundedRect(CGRect(x: 47, y: 98, width: 866, height: 6), radius: 3, fill: color(0xDDE6E1))
    roundedRect(CGRect(x: 47, y: 98, width: 866 * overallProgress, height: 6), radius: 3, fill: color(0x27816A))

    if time < introDuration {
        let appear = ease(time / 0.65)
        let y = 150 + (1 - appear) * 18
        drawText("PASO \(spec.number)", in: CGRect(x: 90, y: y, width: 780, height: 32), size: 16, weight: .bold, color: color(0x2D8067), alignment: .center)
        drawText(spec.title, in: CGRect(x: 90, y: y + 44, width: 780, height: 72), size: 42, weight: .bold, color: color(0x263B35), alignment: .center)
        drawText(spec.summary, in: CGRect(x: 180, y: y + 125, width: 600, height: 70), size: 18, weight: .regular, color: color(0x60736B), alignment: .center)
    } else if time < duration - outroDuration {
        let sceneTime = time - introDuration
        let index = min(spec.scenes.count - 1, Int(sceneTime / sceneDuration))
        let local = sceneTime.truncatingRemainder(dividingBy: sceneDuration)
        let scene = spec.scenes[index]
        let enter = ease(local / 0.45)
        let exit = local > sceneDuration - 0.35 ? CGFloat((sceneDuration - local) / 0.35) : 1
        let alpha = min(enter, max(0, exit))
        let offset = (1 - enter) * 24

        drawText("PASO \(spec.number) DE 4", in: CGRect(x: 72, y: 133, width: 816, height: 24), size: 13, weight: .bold, color: color(0x32806A), alignment: .center)

        roundedRect(CGRect(x: 105, y: 176 + offset, width: 750, height: 268), radius: 30, fill: color(0xFFFFFF, alpha: 0.72 * alpha), stroke: color(0xFFFFFF, alpha: 0.9 * alpha))
        roundedRect(CGRect(x: 150, y: 213 + offset, width: 96, height: 35), radius: 18, fill: color(0xE3F1E7, alpha: alpha))
        drawText(scene.tag, in: CGRect(x: 150, y: 223 + offset, width: 96, height: 18), size: 10, weight: .bold, color: color(0x27715D, alpha: alpha), alignment: .center)
        drawText("\(index + 1)", in: CGRect(x: 695, y: 207 + offset, width: 74, height: 74), size: 42, weight: .bold, color: color(0x79649D, alpha: 0.9 * alpha), alignment: .center)
        drawText(scene.title, in: CGRect(x: 150, y: 276 + offset, width: 610, height: 62), size: 32, weight: .bold, color: color(0x263B35, alpha: alpha))
        drawText(scene.detail, in: CGRect(x: 150, y: 346 + offset, width: 610, height: 58), size: 18, weight: .regular, color: color(0x61736C, alpha: alpha))

        let dotsY: CGFloat = 475
        for dot in 0..<spec.scenes.count {
            roundedRect(CGRect(x: 432 + CGFloat(dot * 26), y: dotsY, width: dot == index ? 18 : 8, height: 8), radius: 4, fill: dot == index ? color(0x27816A) : color(0xB9C8C1))
        }
    } else {
        let appear = ease((time - (duration - outroDuration)) / 0.4)
        drawText("LISTO", in: CGRect(x: 90, y: 185, width: 780, height: 30), size: 15, weight: .bold, color: color(0x2D8067, alpha: appear), alignment: .center)
        drawText("Ya conocés este recorrido", in: CGRect(x: 90, y: 232, width: 780, height: 60), size: 38, weight: .bold, color: color(0x263B35, alpha: appear), alignment: .center)
        drawText("Podés probarlo dentro del prototipo.", in: CGRect(x: 180, y: 310, width: 600, height: 40), size: 18, weight: .regular, color: color(0x60736B, alpha: appear), alignment: .center)
    }

    drawText("VoluntarIAndo · encontrá dónde ayudar", in: CGRect(x: 45, y: 508, width: 870, height: 18), size: 10, weight: .medium, color: color(0x6C7C76), alignment: .center)

    NSGraphicsContext.restoreGraphicsState()
}

func generateVideo(_ spec: VideoSpec) throws {
    let outputURL = outputDirectory.appendingPathComponent("\(spec.slug).mp4")
    let posterURL = outputDirectory.appendingPathComponent("\(spec.slug).png")
    try? FileManager.default.removeItem(at: outputURL)
    let ffmpeg = ProcessInfo.processInfo.environment["FFMPEG_PATH"] ?? "/private/tmp/red-cercana-video-tools/node_modules/ffmpeg-static/ffmpeg"
    let process = Process()
    process.executableURL = URL(fileURLWithPath: ffmpeg)
    process.arguments = [
        "-hide_banner", "-loglevel", "error",
        "-f", "rawvideo", "-pixel_format", "bgra",
        "-video_size", "\(width)x\(height)", "-framerate", "\(fps)",
        "-i", "pipe:0", "-an", "-vf", "vflip", "-c:v", "libx264", "-preset", "veryfast",
        "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        "-y", outputURL.path
    ]
    let inputPipe = Pipe()
    process.standardInput = inputPipe
    process.standardError = FileHandle.standardError
    try process.run()

    let duration = introDuration + Double(spec.scenes.count) * sceneDuration + outroDuration
    let frameCount = Int(duration * Double(fps))
    let bytesPerRow = width * 4
    let byteCount = bytesPerRow * height
    let memory = UnsafeMutableRawPointer.allocate(byteCount: byteCount, alignment: 64)
    defer { memory.deallocate() }

    for frame in 0..<frameCount {
        guard let context = CGContext(
                data: memory,
                width: width,
                height: height,
                bitsPerComponent: 8,
                bytesPerRow: bytesPerRow,
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
        ) else { throw NSError(domain: "Video", code: 1) }
        renderFrame(context, spec: spec, time: Double(frame) / Double(fps), duration: duration)
        inputPipe.fileHandleForWriting.write(Data(bytes: memory, count: byteCount))
    }
    try inputPipe.fileHandleForWriting.close()
    process.waitUntilExit()
    guard process.terminationStatus == 0 else { throw NSError(domain: "Video", code: Int(process.terminationStatus)) }

    // Extraemos el primer cuadro del video ya orientado para usarlo como portada.
    try? FileManager.default.removeItem(at: posterURL)
    let posterProcess = Process()
    posterProcess.executableURL = URL(fileURLWithPath: ffmpeg)
    posterProcess.arguments = [
        "-hide_banner", "-loglevel", "error", "-i", outputURL.path,
        "-frames:v", "1", "-y", posterURL.path
    ]
    posterProcess.standardError = FileHandle.standardError
    try posterProcess.run()
    posterProcess.waitUntilExit()
    guard posterProcess.terminationStatus == 0 else { throw NSError(domain: "Poster", code: Int(posterProcess.terminationStatus)) }
    print("Generated \(outputURL.lastPathComponent)")
}

for video in videos {
    try generateVideo(video)
}
