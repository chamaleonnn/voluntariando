# VoluntarIAndo

Prototipo tecnológico de tesis para vincular personas voluntarias con organizaciones. Los ejemplos iniciales son de Córdoba, pero provincia y modalidad son datos abiertos para que el sistema pueda usarse en otros lugares.

**Título propuesto para la tesis:** *VoluntarIAndo: diseño y desarrollo de un prototipo tecnológico para vincular voluntarios con oportunidades mediante recomendaciones personalizadas.*

Sitio publicado: https://voluntariando.web.app

## Alcance del E3

- ingreso con Google para voluntarios y organizaciones;
- perfil del voluntario con ubicación, intereses, habilidades, disponibilidad y experiencias verificadas;
- perfil de organización y publicación/edición de oportunidades;
- catálogo público con búsqueda, provincia, modalidad y mapa secundario;
- solicitud del voluntario y aceptación o rechazo de la organización;
- registro de la experiencia realizada, sus tareas y habilidades observadas;
- recomendaciones ordenadas por compatibilidad y acompañadas por una explicación breve;
- Vía, un camaleón mecha orientador que combina preguntas breves con las métricas del perfil;
- IA como apoyo semántico, sin inventar información ni cambiar el porcentaje.

El porcentaje usa las ponderaciones documentadas: habilidades 30 %, intereses 20 %, disponibilidad 20 %, ubicación/modalidad 15 % y experiencias previas 15 %.

## Desarrollo

Requiere Node.js 22 o posterior.

```bash
npm install
npm run dev
```

Verificación completa:

```bash
npm run verify
```

Publicación de la interfaz y las reglas:

```bash
npx firebase-tools deploy --only firestore:rules,hosting
```

## Documentación

- [Configuración de Firebase](docs/FIREBASE_SETUP.md)
- [Abrir y ejecutar en IntelliJ IDEA](docs/INTELLIJ_IDEA.md)
- [Arquitectura y datos](docs/ARQUITECTURA.md)
- [Guía para la defensa](docs/GUIA_DEFENSA.md)
- [Plan de pruebas](docs/PRUEBAS.md)

## Pendiente externo

La función semántica está implementada. Para publicarla hace falta habilitar Cloud Functions en el proyecto y configurar el secreto `OPENAI_API_KEY`.
