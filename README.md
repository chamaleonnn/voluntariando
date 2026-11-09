# Voluntariando

Sistema inteligente de gestión y vinculación de voluntariado.

Entrega 4 del Trabajo Final de Grado — Ingeniería en Software — Universidad Siglo 21.

Voluntariando conecta personas interesadas en ayudar con organizaciones que publican oportunidades. La aplicación permite crear perfiles, buscar actividades, registrar postulaciones e invitaciones, confirmar participaciones y guardar las experiencias realizadas.

El sistema recomienda oportunidades a partir de cinco aspectos del perfil: habilidades, intereses, disponibilidad, ubicación o modalidad y experiencias anteriores. El porcentaje se calcula con reglas propias de la aplicación. La integración con OpenAI es un complemento opcional para redactar explicaciones y no modifica ese resultado.

Vía, el asistente visual de la aplicación, acompaña la bienvenida, los tutoriales y la búsqueda de oportunidades.

Aplicación publicada: https://voluntariando.web.app/

## Funciones principales

- acceso con Google para voluntarios, organizaciones y administradores;
- perfiles diferenciados según el tipo de usuario;
- publicación, búsqueda y filtrado de oportunidades;
- postulaciones e invitaciones entre voluntarios y organizaciones;
- registro de participaciones, tareas y habilidades verificadas;
- recomendaciones ordenadas por compatibilidad;
- notificaciones, reseñas y moderación administrativa;
- tutoriales y orientación mediante Vía;
- reglas de seguridad y pruebas automatizadas de Firestore.

## Tecnologías utilizadas

- Next.js, React y TypeScript para la aplicación web;
- Firebase Authentication para el acceso con Google;
- Cloud Firestore para almacenar la información;
- Firebase Hosting para publicar la aplicación;
- Cloud Functions para la integración segura con OpenAI;
- Firebase Emulator Suite para probar las reglas de seguridad.

## Instalación

Se necesita Node.js 22 o una versión compatible.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Antes de iniciar la aplicación, completá `.env.local` con los datos de una aplicación web de Firebase autorizada. El archivo `.env.example` contiene los nombres de las variables necesarias, sin credenciales privadas.

La aplicación queda disponible en `http://localhost:3000`.

## Verificación

Para revisar el formato, compilar la aplicación y ejecutar las pruebas del motor, de Vía y de la validación semántica:

```bash
npm run verify
```

Para instalar y comprobar las Cloud Functions:

```bash
npm --prefix functions ci
npm --prefix functions run check
```

Para ejecutar las pruebas de seguridad e integración de Firestore:

```bash
npx firebase-tools emulators:exec --only firestore --project red-cercana-tao "npm run test:rules"
```

Las pruebas locales no necesitan una clave de OpenAI. Para utilizar la explicación externa en Firebase se debe configurar `OPENAI_API_KEY` como secreto del proyecto y contar con saldo disponible en la API.

## Documentación

- [Arquitectura del sistema](docs/ARQUITECTURA.md)
- [Configuración de Firebase](docs/FIREBASE_SETUP.md)
- [Ejecución en IntelliJ IDEA](docs/INTELLIJ_IDEA.md)
- [Plan de pruebas](docs/PRUEBAS.md)
- [Evidencia técnica final](docs/correcciones-finales-tfg-2026-11-08.md)
