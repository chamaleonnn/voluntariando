# Arquitectura del prototipo

## Idea general

La interfaz está hecha con Next.js/React. Firebase resuelve autenticación con Google, datos en Firestore, permisos y hosting. Una Cloud Function aislada puede pedir a OpenAI una explicación semántica; esa respuesta no calcula ni modifica el porcentaje.

```text
Navegador
   ├── Next.js: interfaz y cálculo determinista
   ├── Firebase Authentication: identidad de Google
   └── Cloud Firestore: perfiles, oportunidades y participaciones
             └── Cloud Function: complemento semántico opcional
```

## Colecciones del alcance

| Colección | Responsabilidad |
| --- | --- |
| `users` | Identidad, correo y rol. |
| `volunteerProfiles` | Intereses, habilidades, disponibilidad y trayectoria. |
| `organizations` | Perfil de la organización. |
| `organizationMembers` | Permisos para gestionar una organización. |
| `opportunities` | Convocatorias, tareas, requisitos, cupos y ubicación/modalidad. |
| `applications` | Interés iniciado por un voluntario y decisión de la organización. |
| `matches` | Participación confirmada. |
| `participations` | Registro de la experiencia completada. |
| `feedback` | Tareas realizadas y habilidades observadas. |
| `adminActions` | Historial inmutable de suspensiones, correcciones y moderaciones. |

## Administración

Las cuentas con rol `admin` pueden consultar usuarios, correos, solicitudes y publicaciones. Las suspensiones tienen motivo y fecha límite; las oportunidades se ocultan cambiando su estado en lugar de borrarse físicamente. Cada intervención crea un documento en `adminActions` con administrador, objetivo, motivo y fecha.

El rol administrador nunca puede elegirse durante el registro público. Para incorporar uno nuevo, otro administrador debe asignar el rol desde Firebase durante el piloto.

## Compatibilidad

El cálculo es transparente y siempre suma 100 puntos:

1. habilidades: 30 %;
2. intereses: 20 %;
3. disponibilidad: 20 %;
4. ubicación o modalidad: 15 %;
5. experiencias previas: 15 %.

Dentro del criterio de habilidades, las verificadas pesan más que las declaradas. La IA solamente detecta relaciones semánticas entre textos equivalentes y redacta una explicación con datos existentes.

## Archivos centrales

- `app/page.tsx`: recorridos público, voluntario y organización.
- `lib/firebase-service.ts`: operaciones de Firebase.
- `lib/recommendations.ts`: cálculo explicable de compatibilidad.
- `firestore.rules`: permisos por rol y propiedad.
- `functions/index.js`: complemento semántico opcional.
