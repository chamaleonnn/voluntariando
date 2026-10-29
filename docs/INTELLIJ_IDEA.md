# Abrir VoluntarIAndo en IntelliJ IDEA

El proyecto está escrito en TypeScript con Next.js y puede ejecutarse directamente en IntelliJ IDEA. No hay que convertirlo a Java ni a Python.

## Primera apertura

1. Abrir IntelliJ IDEA.
2. Elegir **Open**.
3. Seleccionar la carpeta `app` de este repositorio, no la carpeta que la contiene.
4. Esperar a que IntelliJ indexe los archivos.
5. En **Settings > Languages & Frameworks > JavaScript Runtime**, seleccionar Node.js 22 o posterior.
6. Si IntelliJ pregunta si debe confiar en el proyecto, elegir **Trust Project**.

El archivo `.env.local` contiene la configuración local de Firebase y no se publica en GitHub. Si se trabaja desde otra computadora, hay que copiar `.env.example` como `.env.local` y completar sus valores.

## Ejecutar la aplicación

En el selector superior de configuraciones elegir **VoluntarIAndo - desarrollo** y presionar el botón verde. La consola mostrará la dirección local, normalmente:

```text
http://localhost:3000
```

También puede iniciarse desde la terminal integrada:

```bash
npm install
npm run dev
```

## Verificar antes de presentar o publicar

Elegir **VoluntarIAndo - verificar** y presionar el botón verde. Esta configuración ejecuta:

- ESLint, para detectar errores y problemas de estilo;
- TypeScript, para comprobar los tipos;
- el build de producción de Next.js;
- la comprobación de sintaxis de las funciones de Firebase.

La verificación también puede hacerse desde la terminal:

```bash
npm run verify
```

## Archivos principales para la defensa

- `app/page.tsx`: pantallas, navegación y comportamiento principal.
- `app/globals.css`: colores, tarjetas, modo nocturno y animaciones.
- `lib/demo-data.ts`: usuarios y oportunidades de demostración.
- `lib/recommendations.ts`: cálculo de compatibilidad y recomendaciones.
- `lib/firebase.ts`: conexión con Firebase.
- `lib/firebase-service.ts`: inicio de sesión y operaciones con Firestore.
- `firestore.rules`: permisos de la base de datos.
- `functions/index.js`: apoyo semántico opcional mediante IA.

Para realizar un cambio visual rápido durante la defensa, modificar `app/page.tsx` o `app/globals.css` y guardar. El navegador se actualiza automáticamente mientras está activa la configuración de desarrollo.
