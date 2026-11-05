# Estado de continuidad

Actualizado: 5 de noviembre de 2026. Rama: `codex/e4-core`.

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

## Verificado

- Firestore Emulator: 11 pruebas aprobadas, 0 fallidas.
- Motor de recomendaciones: 6 pruebas aprobadas, 0 fallidas, incluida coherencia semántica con pesos invariables.
- ESLint específico de archivos modificados: aprobado.
- Sintaxis de Firebase Function: aprobada.

## Bloqueado externamente

- Ejecución real de OpenAI en producción: Firebase Functions/secreto requieren configurar facturación fuera de Spark. No se activó Blaze ni se desplegó.

## Próximo bloque

- Revisión visual manual en dispositivos reales y pruebas de navegación con usuarios.
- Mejoras visuales y tutoriales interactivos de Vía pospuestos; conservar los cuatro videos actuales.
