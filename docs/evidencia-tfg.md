# Evidencia técnica para la Entrega 4 - Voluntariando

Fecha de corte: 5 de noviembre de 2026. Rama examinada: `codex/e4-core`. Este documento describe el código local actual; no acredita un despliegue nuevo en producción.

## 1. Motor de compatibilidad

El motor reproducible está en `lib/recommendations.ts`. Para cada oportunidad calcula cinco valores enteros entre 0 y 100 y luego aplica:

`compatibilidad = redondear(habilidades × 0,30 + intereses × 0,20 + disponibilidad × 0,20 + ubicación/modalidad × 0,15 + experiencia × 0,15)`

### Cálculo de cada criterio

| Criterio | Cálculo 0-100 | Justificación técnica |
|---|---|---|
| Habilidades (30 %) | `coincidencias / habilidades requeridas × 100`, redondeado. Si la oportunidad no exige habilidades, vale 100. | Compara las habilidades requeridas con las declaradas y verificadas. La relación acepta coincidencia textual y grupos semánticos locales (educación, ambiente, arte, alimentación, tecnología y construcción). |
| Intereses (20 %) | Coincidencia entre `profile.interests` y la categoría de la oportunidad. | Representa afinidad temática sin depender de experiencia previa. |
| Disponibilidad (20 %) | Coincidencia entre disponibilidades del perfil y de la oportunidad. | Evita recomendar como primera opción una actividad incompatible en días u horarios. |
| Ubicación/modalidad (15 %) | Virtual: 100. Presencial con provincia o barrio relacionado: 100. Híbrida sin coincidencia geográfica: 60. Otro caso: 0. | La modalidad virtual elimina la distancia; la híbrida conserva compatibilidad parcial. |
| Experiencia (15 %) | Coincidencia entre tareas/habilidades de experiencias previas y las habilidades requeridas/categoría de la oportunidad. | Permite que la trayectoria confirmada modifique recomendaciones futuras. |

La función `overlap` cuenta cuántos elementos del objetivo encuentran al menos una relación en la fuente. Si el objetivo está vacío devuelve 0, salvo el caso especial de oportunidades sin habilidades requeridas, donde el criterio habilidades se fija en 100.

### Habilidades declaradas y verificadas

- Solo declaradas: se usa su porcentaje de coincidencia.
- Solo verificadas: se usa su porcentaje de coincidencia.
- Ambas fuentes: `habilidades = redondear(declaradas × 0,35 + verificadas × 0,65)`.
- Solo se consideran verificadas las habilidades cuyo contador sea mayor que cero.

El 65 % interno asignado a lo verificado no reemplaza el peso general del 30 %: primero forma el criterio habilidades y luego ese criterio participa con 30 % en el resultado total.

### Perfil sin experiencia

Un perfil nuevo obtiene 0 en experiencia, pero no pierde el criterio habilidades por carecer de verificaciones: si declaró una habilidad compatible, se usa esa declaración completa. La prueba automatizada obtiene habilidades 100, experiencia 0 y total 85. Esto evita penalizar dos veces a quien todavía no participó.

## 2. Prueba de recomendaciones: 55 % a 90 %

Fuente: `scripts/recommendations.test.mjs`, caso `una experiencia relacionada mejora una recomendación futura`. Motor: `lib/recommendations.ts`.

Oportunidad constante: Huerta; categoría Ambiente; habilidad requerida Naturaleza y ambiente; disponibilidad sábado por la mañana; modalidad presencial; ubicación Córdoba.

| Estado | Datos del perfil | Habilidades | Intereses | Disponibilidad | Ubicación | Experiencia | Cálculo | Esperado | Obtenido |
|---|---|---:|---:|---:|---:|---:|---|---:|---:|
| Antes | Córdoba; interés Ambiente; sábado por la mañana; declara Cocina; sin verificaciones ni experiencias | 0 | 100 | 100 | 100 | 0 | `0×.30 + 100×.20 + 100×.20 + 100×.15 + 0×.15` | 55 | 55 |
| Después | Conserva lo anterior; Naturaleza y ambiente verificada una vez; experiencia previa con Preparar huerta y Naturaleza y ambiente | 65 | 100 | 100 | 100 | 100 | `65×.30 + 100×.20 + 100×.20 + 100×.15 + 100×.15 = 89,5`, redondeado | 90 | 90 |

El criterio habilidades queda en 65 porque coexisten Cocina declarada (0 de coincidencia) y Naturaleza y ambiente verificada (100): `0×0,35 + 100×0,65 = 65`. La experiencia queda en 100 porque sus tareas/habilidades se relacionan con la habilidad requerida y la categoría Ambiente.

Resultado registrado de la última ejecución válida de `npm run test:recommendations`: 5 pruebas aprobadas, 0 fallidas. Además del caso 55→90, se comprobaron ponderación completa, perfil nuevo, perfil con solo habilidades verificadas y datos totalmente incompatibles.

## 3. Integración con OpenAI

### Entrada

El cliente `lib/ai-service.ts` invoca la callable `analyzeSemanticCompatibility` con el perfil y la oportunidad. La Function `functions/index.js` reduce esos objetos a:

- Voluntario: intereses, habilidades declaradas, nombres de habilidades verificadas, disponibilidad, ubicación y tareas/habilidades de experiencias.
- Oportunidad: categoría, tareas, habilidades requeridas, disponibilidad, provincia, barrio y modalidad.

La llamada exige autenticación. No se envían correo, nombre, redes sociales ni porcentajes.

### Salida estructurada y validación

OpenAI usa `gpt-5-mini` y un esquema JSON estricto. Devuelve hasta cinco relaciones con `profileEvidence`, `opportunityEvidence` y `relation`. La Function valida que las dos evidencias sean valores literales presentes en la entrada; descarta relaciones que introduzcan evidencia inexistente y construye una explicación breve.

La respuesta final es `{ relationships, explanation }`. La interfaz incorpora únicamente `explanation` en Vía. El porcentaje y el orden de oportunidades permanecen bajo `calculateCompatibility`/`recommendOpportunities`; la IA no puede modificar el puntaje. Si la Function falla o no está desplegada, la interfaz conserva la explicación determinística local.

### Estado y limitaciones

- Implementado: cliente callable, Function autenticada, esquema estricto, filtrado de evidencia, fallback local y verificación sintáctica de `functions/index.js`.
- No verificado: ejecución extremo a extremo contra OpenAI desde la app publicada; no se desplegó la Function ni se efectuó una llamada facturable.
- Limitación Spark: el Hosting, Authentication y Firestore usados por el prototipo pueden mantenerse en Spark dentro de sus cuotas, pero desplegar Functions con secreto y ejecutar OpenAI requiere facturación/configuración externa. Por decisión de alcance no se activó Blaze ni se almacenó una clave en producción.

## 4. Vinculación y experiencias

### Postulación iniciada por el voluntario

1. `createApplication` crea `applications/{oportunidad_usuario}` en estado `pending` y notifica a la organización.
2. La organización acepta o rechaza mediante `updateApplicationStatus`.
3. Al aceptar se crea un `match` confirmado; la respuesta genera una notificación para el voluntario.

### Invitación iniciada por la organización

1. `createInvitation` registra la propuesta `pending` y notifica al voluntario.
2. El voluntario acepta o rechaza mediante `updateInvitationStatus`.
3. Solo al aceptar se crea `matches/invitation_{id}` en estado `confirmed` y se notifica a la organización.

### Experiencia completada

La organización selecciona una participación aceptada, describe las tareas y marca las habilidades realmente observadas. `recordCompletedExperience` ejecuta una transacción que:

- impide registrar dos veces la misma participación;
- crea `participations` y `feedback`;
- cambia el match a `completed`;
- marca como completada la postulación o invitación de origen;
- incrementa cada habilidad seleccionada en `verifiedSkills`;
- agrega tareas y habilidades a `experiences`;
- incrementa `completedExperiences` y guarda `lastExperienceMatchId`.

En el siguiente cálculo, `verifiedSkills` afecta el criterio habilidades y las tareas/habilidades históricas afectan experiencia. La prueba 55→90 demuestra ese cambio con datos controlados.

## 5. Pruebas y seguridad

La última prueba Firestore terminó correctamente mediante el emulador local: 11 casos aprobados, 0 fallidos (`scripts/firestore-rules.test.mjs`).

Permisos comprobados:

1. Una organización propietaria puede cerrar una experiencia proveniente de invitación, crear participación/devolución y actualizar la trayectoria en una sola operación.
2. Un usuario ajeno no puede marcar esa invitación como completada.
3. El voluntario no puede acreditarse habilidades verificadas por cuenta propia.
4. Una organización pendiente no puede publicar oportunidades.
5. Un administrador puede validar una organización pendiente.
6. Una ausencia solo puede ser informada por una organización vinculada y confirmada por administración.
7. La visibilidad elegida por el voluntario impide leer perfiles privados.
8. Una devolución negativa requiere moderación administrativa y la advertencia es privada.
9. Una suspensión vencida puede reactivarse sin permitir cambios de estado arbitrarios.

También existen reglas para usuarios, perfiles, oportunidades, postulaciones, notificaciones, invitaciones, matches, reseñas, denuncias, fotos y acciones administrativas, pero no todas poseen todavía una prueba automatizada específica. Permanecen sin verificación automatizada extremo a extremo: Google Auth real, cada transición de postulaciones, lectura/marcado de notificaciones, reseñas y denuncias, moderación fotográfica, suspensión de cuentas, privacidad de perfiles y acceso de administración a todos los recursos. La compilación y el lint pasan, pero no sustituyen esas pruebas de permisos.

## 6. Estado del prototipo

### Terminado en el código actual

- Acceso con Google, consentimiento previo y tres roles.
- Alta y edición obligatoria inicial de perfiles de voluntario y organización.
- Catálogo público, búsqueda, filtros por provincia/modalidad y mapa secundario.
- Motor local 0-100, desglose, orden y explicación reproducibles.
- Postulaciones, aceptación/rechazo, invitaciones, matches y notificaciones internas.
- Registro de experiencia completada, tareas, habilidades verificadas y actualización de trayectoria.
- Reseñas públicas con estrellas, anonimato opcional, denuncia y moderación de fotos.
- Administración de usuarios, organizaciones, oportunidades y contenido; validación de organizaciones y trazabilidad de acciones.
- Pruebas automatizadas del motor y de cinco permisos críticos de Firestore.

### Parcial

- OpenAI: código y fallback implementados; llamada real no desplegada/verificada por límites de Spark.
- Privacidad: el voluntario controla por separado la visibilidad para organizaciones y para otros voluntarios; las reglas y una prueba automatizada respetan ambas decisiones.
- Contacto posterior al match: el correo se muestra únicamente después de aceptar una postulación o invitación.
- Experiencias: tareas y habilidades funcionan; no se registran horas verificadas ni existe aprobación administrativa previa de toda devolución.
- Moderación/suspensión: dos devoluciones negativas confirmadas en 90 días o tres ausencias confirmadas habilitan suspensión temporal, siempre después de revisión administrativa.

### Pospuesto, no eliminado

- Mejoras visuales de Vía y sus tutoriales interactivos.
- Producción y validación extremo a extremo de OpenAI.
- Videos tutoriales nuevos: se conservan sin cambios los cuatro videos actuales.
- Automatización del aviso previo por correo; la interfaz informa el criterio de seis horas y la organización puede reportar incumplimientos.

### Correspondencia con las historias de usuario

La fuente académica disponible (`Tesis - Prototipado Tecnologico.pdf`) contiene 22 historias, no 14. Dado que la consigna solicita 14, esta comparación toma HU-01 a HU-14 sin afirmar que sea una versión definitiva del alcance.

| HU | Estado actual | Diferencia relevante |
|---|---|---|
| HU-01 Google | Terminada | Falta prueba automatizada con proveedor Google real. |
| HU-02 Perfil voluntario | Terminada | Onboarding obligatorio y edición implementados. |
| HU-03 Privacidad/visibilidad | Terminada | Controles separados, redes opcionales y reglas verificadas. |
| HU-04 Organización | Terminada | Alta pendiente, edición y administración implementadas. |
| HU-05 Validar organización | Terminada | Admin valida/suspende; organización pendiente no publica. |
| HU-06 Gestionar oportunidades | Terminada | Crear, editar, publicar y moderar; no se borra físicamente. |
| HU-07 Explorar sin sesión | Terminada | Catálogo público y filtros disponibles. |
| HU-08 Buscar como voluntario | Terminada | Búsqueda, filtros, orden personalizado y detalle del cálculo. |
| HU-09 Explorar voluntarios | Parcial | La organización ve perfiles e invita; filtrado avanzado de voluntarios no está desarrollado. |
| HU-10 Interés, invitaciones y matches | Terminada | Ambos caminos crean match solo cuando corresponde. |
| HU-11 Consultar estados | Terminada | Estados visibles en paneles y notificaciones. |
| HU-12 Contacto tras match | Terminada | El correo aparece después de aceptar el vínculo. |
| HU-13 Completada/cancelación/ausencia | Parcial | Completada y ausencia revisada funcionan; la cancelación autónoma previa no está implementada. |
| HU-14 Horas, tareas, habilidades y devolución | Parcial | Tareas, habilidades y devolución se guardan; horas verificadas no se actualizan. |

Para una corrección definitiva contra exactamente 14 historias debe aportarse la versión del documento que las enumera; usar otra selección implicaría inventar el alcance académico.
