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

## Verificado

- Firestore Emulator: 9 pruebas aprobadas, 0 fallidas.
- Motor de recomendaciones: 6 pruebas aprobadas, 0 fallidas, incluida coherencia semántica con pesos invariables.
- ESLint específico de archivos modificados: aprobado.
- Sintaxis de Firebase Function: aprobada.

## Bloqueado externamente

- Ejecución real de OpenAI en producción: Firebase Functions/secreto requieren configurar facturación fuera de Spark. No se activó Blaze ni se desplegó.

## Próximo bloque

- Ausencias y avisos de participación.
- Pulido móvil y accesibilidad.
- Mejoras visuales y tutoriales interactivos de Vía pospuestos; conservar los cuatro videos actuales.
