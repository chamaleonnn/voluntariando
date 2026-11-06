# Estado de continuidad

Actualizado: 5 de noviembre de 2026. Rama de trabajo visual: `codex/via-evolution`.

## Completado

- Seguridad del cierre de experiencias: una organización vinculada puede registrar participación, tareas y habilidades; terceros no pueden leer ni modificar participaciones ajenas; el voluntario no puede autoasignarse habilidades verificadas.
- Relaciones semánticas integradas al mismo cálculo determinista 30/20/20/15/15.
- Caché por perfil/oportunidad para evitar llamadas idénticas repetidas a OpenAI.
- Vía conserva fallback local y muestra el resultado recalculado por el motor único.
- Validación administrativa de organizaciones: alta pendiente y publicación bloqueada hasta aprobación.
- Devoluciones con aspectos a mejorar: revisión administrativa, advertencia privada, conteo de 90 días y suspensión temporal al segundo caso confirmado.
- Reactivación segura al vencer una suspensión temporal.
- Ausencias sobre participaciones confirmadas: reporte no duplicable, revisión administrativa, historial visible, avisos privados y suspensión temporal al tercer caso confirmado. La interfaz recuerda el aviso mínimo de 6 horas.
- Ajustes móviles de diálogos, formularios, acciones administrativas y textos accesibles sin cambiar el diseño general.
- Privacidad efectiva para perfiles visibles a organizaciones/voluntarios, comunidad de voluntarios con redes opcionales y correos habilitados únicamente después de una aceptación.
- Validador local de respuestas semánticas: limita a cinco relaciones, exige estructura válida y descarta evidencias inventadas antes de afectar el motor.
- Vía conserva `public/via-mecha.png` como original y utiliza `public/via-mecha-scout.png` como variante integrada: ocho estados animados, parpadeo, habla visual, expresiones, pañuelito scout con textura 3D, minimización y adaptación móvil.
- Bienvenida tipo videojuego posterior al perfil obligatorio: modal protagonista, texto progresivo, foco controlado, teclado, omisión y transición continua de Vía grande al acompañante pequeño.
- Recorrido guiado por componentes reales: seis etapas por rol, cambio de pantalla, posicionamiento contextual, resaltado, anterior/siguiente, omisión, reinicio manual y persistencia local por usuario.
- Cuatro videos de la landing regenerados en H.264, 1280×720, 30 fps y 15 segundos, conservando guion y contenido; Vía incorpora pañuelito, parpadeo, movimiento y habla visual. Originales preservados en `public/videos/originales/`.
- Acceso con Google corregido para usar el dominio oficial de autenticación `red-cercana-tao.firebaseapp.com` desde el hosting público.
- Inicio de sesión simplificado: se retiraron los accesos demo y el selector de roles ficticios; quedan únicamente las tres entradas reales con Google.
- Acceso de Google migrado a redirección completa y verificado hasta la pantalla real de selección de cuenta; el HTML público ya no se conserva en caché para evitar servir versiones antiguas.

## Verificado

- Firestore Emulator: 11 pruebas aprobadas, 0 fallidas.
- Motor de recomendaciones: 6 pruebas aprobadas, 0 fallidas, incluida coherencia semántica con pesos invariables.
- ESLint específico de archivos modificados: aprobado.
- Sintaxis de Firebase Function: aprobada.
- Validación semántica de OpenAI: 2 pruebas locales aprobadas, 0 fallidas.
- Recorridos de Vía: 4 pruebas aprobadas, 0 fallidas; comprueban destinos reales, videos y respaldos, persistencia por rol y conservación de ambos recursos gráficos.

## Bloqueado externamente

- Ejecución real de OpenAI en producción: Firebase Functions/secreto requieren configurar facturación fuera de Spark. No se activó Blaze ni se desplegó.
- Verificación visual automatizada local: el navegador conserva una política que bloquea `localhost:3000`; se validó por compilación, análisis estático y revisión de los cuatro pósteres, sin intentar eludirla.

## Próximo bloque

- Revisión visual manual en dispositivos reales y pruebas de navegación con usuarios.
- Revisar los tutoriales y videos publicados en dispositivos reales con usuarios de ambos roles.
