# Auditoría técnica y funcional integral - VoluntarIAndo

**Fecha de cierre:** 7 de noviembre de 2026  
**Proyecto Firebase:** `red-cercana-tao`  
**Aplicación:** https://voluntariando.web.app/  
**Rama de auditoría:** `codex/tfg-audit-2026-11-07`  
**Base auditada:** commit `1436e6c` (`feat: preview Via celebrations from admin`)

## Alcance y criterio

La auditoría verificó código, pruebas automatizadas, reglas de Firestore, configuración de Firebase, registros de Cloud Functions, archivos publicados y recorridos de lectura en producción. No se modificaron datos reales, no se ejecutaron restauraciones, no se activó facturación y no se desplegaron cambios.

La apariencia, animaciones, pañuelo, tutorial y videos de Vía no fueron modificados. Sus cinco pruebas existentes continuaron aprobando.

Los estados usados en este informe son:

- **Verificada:** existe una prueba funcional o automatizada suficiente para el alcance indicado.
- **Parcial:** hay implementación, pero falta una prueba integral o existe un bloqueo externo.
- **No implementada:** no se encontró la funcionalidad requerida.
- **No comprobada:** no existe evidencia suficiente para emitir un resultado.

## A. Estado general del proyecto

### Funciona y fue comprobado

- Compilación de producción, TypeScript y linter.
- Motor determinista 30/20/20/15/15 y ponderación interna 35/65 para habilidades.
- Caso matemático 55 % -> 90 %.
- Caso integrado 55 % -> 90 % después de persistir la experiencia en Firestore emulado y volver a leer el perfil.
- Ordenamiento de recomendaciones y valores limitados a 0-100.
- Normalización de tildes y grupos de términos relacionados.
- Tratamiento de perfiles nuevos, oportunidades sin habilidades obligatorias y modalidades virtual, híbrida y presencial.
- Postulación válida, aceptación, creación de vinculación y rechazo de transiciones inválidas en reglas aisladas.
- Invitación, aceptación y prevención de una segunda vinculación sobre la misma invitación.
- Registro de participación, tareas, devolución y habilidades verificadas.
- Privacidad de perfiles y rechazo del acceso de terceros a participaciones ajenas.
- Validación administrativa de organizaciones, devoluciones y ausencias.
- Aplicación publicada, catálogo público, panel administrativo, recuperación de sesión y vista móvil sin desbordamiento horizontal.
- Programación diaria de respaldos de Firestore y existencia de dos respaldos listos.

### Funciona parcialmente

- Inicio con Google: existe una sesión real y se comprobó su recuperación después de recargar, pero no se repitió un alta completa durante esta auditoría.
- Perfiles y publicación: existen código y permisos; no se escribieron datos de producción para repetir los formularios de ambos roles.
- Recorrido integral desde la interfaz: se comprobó producción en lectura, pero los recorridos que crean datos se reprodujeron de forma aislada con el emulador.
- OpenAI: la Function está activa y autenticada, pero las solicitudes reales registradas terminaron con `insufficient_quota`.

### No implementado o fuera del núcleo comprobado

- Cancelación autónoma previa de una participación por parte del voluntario.
- Actualización efectiva de horas verificadas; el campo existe, pero el cierre de experiencia actualiza tareas, habilidades y cantidad de experiencias.
- Filtro avanzado de voluntarios para organizaciones.

### No comprobado

- Alta completa de un voluntario nuevo y una organización nueva en producción durante esta auditoría.
- Restauración de un respaldo. No se realizó para no crear ni alterar bases de producción.
- Respuesta exitosa actual de GPT-5 mini por falta de crédito de la API.

## B. Matriz de las 14 historias de usuario

| ID | Funcionalidad | Evidencia en código | Prueba realizada | Resultado | Estado | Limitación |
|---|---|---|---|---|---|---|
| HU-01 | Iniciar sesión con Google | `lib/firebase-service.ts`, `app/page.tsx` | Sesión real recuperada después de recargar producción; configuración de Authentication compilada | La sesión volvió a estado administrador después de la carga asíncrona | Parcial | No se repitió el selector de Google ni un alta desde cero |
| HU-02 | Perfil del voluntario | `VolunteerProfileDialog`, `saveVolunteerProfile`, reglas de `volunteerProfiles` | Compilación; pruebas de privacidad y rechazo de autoasignación de habilidades | Persistencia y campos editables protegidos | Parcial | No se guardó un perfil real nuevo desde la interfaz |
| HU-03 | Perfil de organización | `OrganizationProfileDialog`, `saveOrganizationProfile`, reglas de `organizations` | Compilación; validación de organización pendiente en emulador | Perfil pendiente y bloqueo de publicación funcionan en reglas | Parcial | No se completó un alta real nueva desde la interfaz |
| HU-04 | Crear y publicar oportunidades | `OpportunityEditor`, `createOpportunity`, `updateOpportunity` | Catálogo publicado en producción; organización pendiente rechazada por reglas | Lectura pública y restricción de publicación verificadas | Parcial | No se creó una oportunidad real durante la auditoría |
| HU-05 | Registrar datos para compatibilidad | `lib/types.ts`, formularios obligatorios y editor de oportunidades | Diez pruebas del motor usan perfil, intereses, habilidades, disponibilidad, ubicación y experiencia | Los datos requeridos llegan al cálculo | Verificada | La calidad depende de lo declarado por los usuarios |
| HU-06 | Calcular compatibilidad | `lib/recommendations.ts` | Diez pruebas automatizadas | Pesos, redondeos, límites y casos borde aprobados | Verificada | No depende de OpenAI |
| HU-07 | Analizar relaciones mediante IA | `lib/ai-service.ts`, `functions/index.js`, `semantic-validation.js` | Function activa; autenticación válida; 2/2 validaciones locales; lectura de logs | La invocación llega, pero OpenAI responde 429 por falta de crédito | Parcial | No hubo respuesta exitosa de GPT-5 mini |
| HU-08 | Generar recomendaciones | `recommendOpportunities` y panel de voluntario | Ordenamiento automatizado, caso sin coincidencias y progresión por experiencia | Orden descendente y valores 0-100 aprobados | Verificada | La visualización personalizada no se repitió con una cuenta voluntaria real |
| HU-09 | Explicar la recomendación | Explicación determinista y resultado semántico opcional | Pruebas del motor y validación estructurada | Siempre existe explicación local; la IA no altera el puntaje | Verificada | La explicación de GPT queda bloqueada por cuota |
| HU-10 | Manifestar interés | `createApplication`, reglas de `applications` | Postulación válida aceptada y datos falsificados rechazados en emulador | Documento consistente y no duplicable por ID determinista | Parcial | No se creó una postulación real desde producción |
| HU-11 | Confirmar vinculación | `updateApplicationStatus`, `updateInvitationStatus`, reglas de `matches` | Flujo de postulación y flujo de invitación probados en emulador | Se crea una vinculación solo con aceptación válida | Verificada | Prueba de integración de datos, no recorrido visual completo |
| HU-12 | Registrar participación | `recordCompletedExperience`, `participations` | Cierre transaccional de experiencia invitada | Participación persistida una sola vez | Verificada | No se ejecutó sobre producción |
| HU-13 | Registrar tareas y habilidades | `ExperienceDialog`, `feedback`, `volunteerProfiles` | Integración emulada con tareas, habilidad y devolución | Se persisten y se rechaza la autoacreditación del voluntario | Verificada | Horas verificadas no se incrementan |
| HU-14 | Actualizar perfil y recomendaciones | Perfil actualizado en transacción y motor compartido | Caso integrado 55 % -> 90 % después de volver a leer Firestore | Desglose final 65/100/100/100/100 y resultado 90 | Verificada | No se reprodujo completo desde la interfaz |

**Resumen:** 8 verificadas y 6 parciales. No hay historias del núcleo clasificadas como no implementadas, aunque HU-13 conserva la limitación de horas y las seis parciales necesitan una prueba visual o externa adicional.

## C. Motor de compatibilidad

### Fórmula implementada

Cada coincidencia se normaliza entre 0 y 100. Para listas se utiliza:

`coincidencia = redondear(cantidad de objetivos relacionados / cantidad de objetivos * 100)`

El resultado final es:

`redondear(habilidades*0.30 + intereses*0.20 + disponibilidad*0.20 + ubicación*0.15 + experiencia*0.15)`

Reglas particulares:

- Si una oportunidad no exige habilidades, el criterio habilidades vale 100.
- Si existen habilidades declaradas y verificadas: `redondear(declaradas*0.35 + verificadas*0.65)`.
- Si solo existe una de las dos fuentes, se usa esa fuente completa; un perfil nuevo no recibe una penalización artificial por no tener verificaciones.
- Modalidad virtual: ubicación 100.
- Modalidad híbrida sin coincidencia geográfica: ubicación 60.
- Modalidad presencial: 100 si coincide provincia o barrio; en caso contrario, 0.
- Experiencia compara tareas y habilidades históricas contra habilidades requeridas y categoría.
- OpenAI no se entrega como entrada a `calculateCompatibility`.

### Caso 55 % -> 90 %

**Antes:**

| Criterio | Valor | Aporte |
|---|---:|---:|
| Habilidades | 0 | 0 |
| Intereses | 100 | 20 |
| Disponibilidad | 100 | 20 |
| Ubicación | 100 | 15 |
| Experiencia | 0 | 0 |
| **Total** | | **55** |

**Después de verificar “Naturaleza y ambiente” y registrar una experiencia relacionada:**

| Criterio | Valor | Aporte |
|---|---:|---:|
| Habilidades | 65 | 19,5 |
| Intereses | 100 | 20 |
| Disponibilidad | 100 | 20 |
| Ubicación | 100 | 15 |
| Experiencia | 100 | 15 |
| **Total previo al redondeo** | | **89,5** |
| **Total final** | | **90** |

### Niveles de evidencia

- **Prueba matemática:** aprobada en `scripts/recommendations.test.mjs`.
- **Prueba automatizada de integración:** aprobada en `scripts/firestore-rules.test.mjs`; se escribió la experiencia en Firestore emulado, se recuperó el perfil y se obtuvo 90.
- **Prueba funcional desde la interfaz:** no ejecutada de punta a punta; no debe presentarse como verificada todavía.

## D. OpenAI

### Implementación comprobada

- Function callable `analyzeSemanticCompatibility`, versión 2, región `southamerica-east1`, Node.js 22, estado activo.
- Secreto `OPENAI_API_KEY` versión 1 asociado a la Function; la clave no está versionada ni se leyó durante la auditoría.
- Modelo configurado: `gpt-5-mini`.
- Solicitud autenticada: los logs registran `auth: VALID`.
- Esquema JSON estricto, máximo cinco relaciones y evidencia literal obligatoria.
- Dos pruebas locales validan la aceptación de evidencia real y el descarte de evidencia inventada.
- La interfaz recalcula el porcentaje exclusivamente con el motor local y usa la IA solo para el texto.
- Ante error, la interfaz conserva la explicación determinista.

### Resultado real

Las solicitudes registradas el 5 de noviembre llegaron a la Function y a OpenAI, pero terminaron con HTTP 429 y código `credit_balance_exhausted`. No se generó una explicación exitosa verificable. No se realizó una nueva llamada paga.

### Corrección local

La Function ahora transforma errores externos o respuestas inválidas en `HttpsError("unavailable")` y evita devolver detalles internos. El cambio está probado por sintaxis, pero no está desplegado.

### Estado

**Parcial.** La arquitectura, autenticación, secreto, solicitud, validación y fallback están comprobados. Falta disponer de crédito y ejecutar una respuesta exitosa controlada para aprobar GPT-5 mini de punta a punta.

## E. Seguridad

### Hallazgos corregidos localmente

| Severidad | Hallazgo | Riesgo | Corrección | Prueba |
|---|---|---|---|---|
| Crítica | Una cuenta autenticada podía crear una membresía `owner` sobre una organización ajena | Escalada a permisos de organización | La membresía inicial exige que organización, propietario, usuario autenticado e ID coincidan | Ataque rechazado en emulador |
| Alta | Una postulación podía declarar otra organización o correo | Suplantación e inconsistencia de notificaciones | Se valida organización contra la oportunidad y correo contra Authentication | Datos falsificados rechazados |
| Alta | Una organización podía crear un match sin postulación aceptada | Vinculación no consentida | El match exige postulación aceptada o invitación aceptada y campos coincidentes | Match arbitrario rechazado |
| Alta | Las postulaciones y matches permitían cambios de estado o identidad demasiado amplios | Regresiones y documentos inconsistentes | Se limitaron campos y transiciones permitidas | Regresión a pendiente rechazada |
| Media | Participaciones, ausencias y devoluciones no comparaban todos los identificadores relacionados | Asociación cruzada de registros | Se comparan match, organización, usuario y oportunidad | Flujos válidos siguen aprobando |

### Cobertura final de reglas

- 18 pruebas aprobadas, 0 fallidas.
- Se probaron accesos positivos y negativos.
- Los mensajes `PERMISSION_DENIED` del emulador corresponden a rechazos esperados por las pruebas.
- Storage permanece bloqueado completamente; las fotografías moderadas se guardan comprimidas como datos controlados en Firestore.

### Observaciones pendientes

- Los cambios de reglas aún no están en producción. Hasta desplegarlos, producción conserva la versión anterior.
- Los logs de la callable muestran `app: MISSING`: Authentication se valida, pero App Check no está aplicado. Es una mejora de defensa en profundidad antes de habilitar crédito de OpenAI.
- El correo de arranque del primer administrador está declarado explícitamente en reglas. Es coherente con el prototipo, pero debe documentarse como decisión de bootstrap.

## F. Infraestructura

### Firestore y respaldos

| Elemento | Resultado comprobado |
|---|---|
| Proyecto | `red-cercana-tao` |
| Base | `(default)` |
| Tipo | Firestore Native, edición Standard |
| Región | `southamerica-east1` |
| Protección contra borrado | Activada |
| PITR | Desactivado |
| Programación | Diaria |
| Retención | 604800 segundos, equivalentes a 7 días |
| Creación de la programación | 5 de noviembre de 2026, 20:40 hora de Córdoba aproximadamente |
| Último respaldo observado | 7 de noviembre de 2026, 04:23 hora de Córdoba, estado `READY` |
| Respaldo anterior | 6 de noviembre de 2026, 04:19 hora de Córdoba, estado `READY` |
| Ubicación de respaldos | `southamerica-east1`, junto a la base origen |

No se ejecutó una restauración. Firestore restaura un respaldo en una base nueva; los roles oficiales aplicables incluyen `roles/datastore.restoreAdmin` para iniciar la restauración, `roles/datastore.backupsViewer` para lectura y `roles/datastore.backupsAdmin` para administración. Referencia: https://firebase.google.com/docs/firestore/backups

### Producción frente al código local

- El archivo JavaScript principal publicado y el generado localmente tenían el mismo SHA-256: `1f399d8d2d48cc5e464f55d93a6b246963a2a8bcdb62ec2941124fa075c9e1f2`.
- El CSS publicado y el local tenían el mismo SHA-256: `2e0899453b1875ef19fcffe2ebd99ef23f0e95cba491c9a25e213d3f9f3811aa`.
- La fecha de modificación de Hosting coincide con la última serie de commits visuales del 6 de noviembre.
- La interfaz publicada coincide con la base local auditada.
- No coinciden todavía las reglas reforzadas, las pruebas nuevas ni el manejo controlado de errores de la Function, porque no se desplegaron.

## G. Planificación

### Evidencia disponible

- El Gantt planifica 18 actividades entre el 17 de agosto y el 9 de noviembre de 2026.
- El historial Git disponible comienza el 22 de octubre de 2026 y contiene actividad hasta el 6 de noviembre.
- Por lo tanto, Git permite asociar funcionalidades con commits, pero no demostrar duraciones reales de agosto, septiembre o comienzos de octubre.
- La concentración de commits no equivale a horas trabajadas: puede incluir trabajo preparado previamente, importaciones o confirmaciones agrupadas.

### Story Points y días

- Los Story Points del Product Backlog representan complejidad, incertidumbre y esfuerzo relativo.
- Los días del Sprint Backlog y del Gantt representan una estimación temporal de calendario o ejecución.
- No existe una conversión válida `1 Story Point = 1 día`.
- En la versión revisada, las historias de 13 puntos no están todas estimadas en 13 días: HU-06 figura con 11 días, HU-07 con 12 y HU-14 con 11. Esto ayuda a demostrar que son escalas diferentes, aunque conviene explicarlo expresamente.
- Las actividades del Gantt agrupan varias historias y se superponen; no deben sumarse para calcular automáticamente la duración total del Sprint.

### Inconsistencias o aclaraciones necesarias

1. Los Sprint Backlogs marcan HU-07 como “Hecho”, pero la ejecución productiva de OpenAI no logró una respuesta por falta de crédito. Se recomienda presentar “implementación terminada; validación productiva parcial”.
2. HU-01, HU-02, HU-03, HU-04 y HU-10 tienen implementación, pero la auditoría no repitió todos sus recorridos de escritura en producción. “Hecho” debe distinguirse de “probado de punta a punta”.
3. El historial no sustenta tiempos reales por historia. Los días deben presentarse como **estimaciones planificadas**, no como mediciones históricas.
4. No se recomienda modificar fechas ni distribuir días retroactivamente sin una fuente adicional, como bitácoras, entregas, archivos fechados o registros de trabajo.

## H. Correcciones realizadas

| Archivo | Cambio | Motivo | Verificación |
|---|---|---|---|
| `firestore.rules` | Refuerzo de membresías, postulaciones, matches, participaciones, ausencias y devoluciones | Cerrar escaladas e inconsistencias detectadas | 18/18 reglas aprobadas |
| `scripts/firestore-rules.test.mjs` | Pruebas de ataques, ambos recorridos de vinculación y caso integrado 55 -> 90 | Evitar regresiones y aportar evidencia | 18/18 aprobadas |
| `scripts/recommendations.test.mjs` | Desgloses exactos y casos borde | Completar evidencia matemática | 10/10 aprobadas |
| `package.json` | Ejecución de pruebas de reglas con soporte TypeScript | Reutilizar el motor real en integración | Aprobada en emulador |
| `functions/index.js` | Error externo convertido a respuesta controlada | Preservar fallback y no filtrar detalles | Sintaxis y pruebas de validación aprobadas |

No se modificaron componentes, estilos, imágenes, animaciones ni videos de Vía.

## I. Demostración para la tesis

### Puede mostrarse con confianza

- Landing, identidad visual, oportunidades públicas y filtros.
- Inicio de sesión ya establecido y recuperación de sesión.
- Panel administrativo en modo lectura.
- Vista móvil sin desbordamiento horizontal.
- Fórmula de compatibilidad y prueba automatizada 55 -> 90.
- Flujo de reglas aislado para postulación, invitación, vinculación, participación y actualización de trayectoria.
- Vía, bienvenida, tutoriales y cuatro videos existentes.
- Política de respaldo diaria y respaldos reales disponibles.

### Requiere preparación adicional

- Preparar cuentas de prueba independientes para voluntario y organización.
- Preparar una oportunidad y una participación que puedan completarse durante la grabación sin usar datos personales.
- Desplegar primero las reglas reforzadas si se desea crear datos durante la demostración pública.
- Cargar crédito de OpenAI solo si se decide demostrar una explicación real; luego hacer una única prueba controlada.

### No debe presentarse todavía como completamente verificado

- Respuesta exitosa de GPT-5 mini en producción.
- Restauración real de un respaldo.
- Recorrido visual completo de alta -> postulación -> aceptación -> experiencia -> recomendación actualizado en una sola sesión.
- Cancelación autónoma y acumulación de horas verificadas.

## Resultado de pruebas final

| Grupo | Resultado |
|---|---:|
| Linter | Aprobado |
| TypeScript / compilación | Aprobado |
| Motor de recomendaciones | 10/10 |
| Vía | 5/5 |
| Validación semántica | 2/2 |
| Reglas e integración Firestore | 18/18 |
| **Total de pruebas automatizadas** | **35/35** |

## Conclusión

El núcleo determinista, las vinculaciones y la actualización de trayectoria tienen evidencia automatizada suficiente para una demostración académica controlada. La principal limitación externa es OpenAI sin crédito. La principal corrección técnica de la auditoría es el refuerzo de las reglas de Firestore; debe desplegarse antes de considerar producción alineada con esta rama. La planificación puede defenderse si los Story Points se presentan como esfuerzo relativo y los días como estimaciones, sin afirmar tiempos históricos que Git no permite demostrar.
