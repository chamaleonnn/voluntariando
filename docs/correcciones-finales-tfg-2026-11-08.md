# Correcciones finales posteriores a la auditoría - VoluntarIAndo

**Fecha:** 8 de noviembre de 2026  
**Proyecto Firebase:** `red-cercana-tao`  
**Aplicación publicada:** https://voluntariando.web.app/  
**Rama de trabajo:** `codex/final-tfg-corrections`  
**Base:** commit de auditoría `0e6923e`

## Alcance y criterio

Este cierre reutiliza la auditoría del 7 de noviembre y se concentra en seguridad, recorridos funcionales, compatibilidad y coherencia con la tesis. No se modificaron datos de producción, no se desplegaron reglas, no se ejecutaron restauraciones y no se realizaron llamadas nuevas a OpenAI.

La integración con OpenAI se considera técnicamente implementada: la callable está desplegada, autentica, utiliza el secreto y alcanza el servicio externo. La respuesta exitosa de GPT-5 mini continúa pendiente por `credit_balance_exhausted`. El motor determinista y la explicación local siguen funcionando sin depender de ese servicio.

Vía, su pañuelo, sus animaciones, su tutorial, su transición y los cuatro videos no fueron modificados. Sus cinco pruebas de regresión continuaron aprobando.

## A. Estado de seguridad

### Vulnerabilidades corregidas localmente

| Severidad | Problema | Corrección preparada | Evidencia |
|---|---|---|---|
| Crítica | Un usuario autenticado podía intentar adjudicarse la propiedad de una organización ajena | La membresía inicial exige coincidencia entre UID, organización, propietario e ID determinista | Ataque rechazado por el emulador |
| Crítica | Un voluntario podía intentar crear su perfil inicial con experiencias o habilidades verificadas inventadas | El alta exige cero experiencias, cero horas, mapa de habilidades vacío y trayectoria vacía | Alta legítima aceptada; alta falsificada rechazada |
| Alta | Una organización podía inflar niveles de habilidades después de una experiencia válida | Cada habilidad seleccionada debe pertenecer al catálogo final, puede aumentar exactamente una unidad y solo se aceptan tres por experiencia | Intento de nivel 99 y cuarta habilidad rechazados |
| Alta | Cuentas suspendidas conservaban capacidad técnica de realizar algunas escrituras directas | Las operaciones sensibles exigen cuenta activa y rol correcto | Organización y cuenta suspendida no pueden postularse ni actuar con otro rol |
| Alta | Una oportunidad podía transferirse modificando `organizationId` | La organización propietaria queda inmutable en actualizaciones normales | Edición legítima aceptada; transferencia rechazada |
| Alta | Postulaciones, matches, participaciones, ausencias y devoluciones podían tener relaciones inconsistentes | Se comparan usuario, organización, oportunidad, match y estado previo | Recorridos válidos aprobados y asociaciones falsas rechazadas |
| Media | Invitaciones no exigían organización validada ni oportunidad pública | Se exige organización verificada, oportunidad pública y pertenencia correcta | Organización pendiente continúa bloqueada |
| Media | Una devolución podía declarar otro correo o más habilidades que las permitidas | El correo debe coincidir con Authentication; tareas y habilidades tienen tipo y límites | Flujo real aceptado y datos fuera de contrato rechazados |
| Media | Operaciones administrativas no verificaban de forma uniforme al actor | Administración exige rol activo; las acciones de auditoría deben identificar al administrador autenticado | Usuario común no puede validar, moderar ni crear acciones administrativas |

### Permisos legítimos preservados

Las pruebas aceptan expresamente:

- alta inicial de voluntario con perfil vacío;
- edición completa del perfil del voluntario conservando campos protegidos;
- alta inicial de organización con su membresía propietaria;
- edición del perfil de organización;
- validación administrativa de una organización;
- creación y edición de oportunidades por una organización verificada;
- postulación válida de un voluntario activo;
- aceptación y rechazo de solicitudes;
- aceptación de invitaciones;
- cierre de experiencia con tareas y hasta tres habilidades;
- revisión administrativa de devoluciones, ausencias, reseñas denunciadas y fotografías.

### Cobertura de reglas

- **27/27 pruebas de Firestore aprobadas.**
- Incluyen permisos permitidos y denegados.
- Incluyen un recorrido integral completo y el caso 55 % -> 90 %.
- Los `PERMISSION_DENIED` de los registros de prueba corresponden a ataques o acciones inválidas que debían ser rechazadas.

### Publicación pendiente

No se publicó ningún cambio. La producción mantiene las reglas anteriores.

**Único archivo que se publicaría:**

- `firestore.rules`

**Único recurso afectado:**

- reglas de seguridad de `projects/red-cercana-tao/databases/(default)`.

No se publicarán Hosting, Functions, índices, Storage, estilos ni componentes. El despliegue de reglas no modifica documentos o colecciones existentes.

### Diferencias entre producción y las reglas preparadas

La versión preparada agrega:

1. propiedad de organizaciones no transferible por el cliente;
2. rol y estado activo en operaciones sensibles;
3. alta segura de perfiles sin trayectoria inventada;
4. correo y organización de postulaciones ligados a Authentication y a la oportunidad;
5. estados de postulación y match con transiciones limitadas;
6. coincidencia obligatoria entre match, participación, devolución y ausencia;
7. catálogo final de ocho habilidades, incremento de una unidad y máximo de tres por experiencia;
8. moderación reservada a administración;
9. invitaciones limitadas a organizaciones verificadas y oportunidades públicas;
10. conservación de los accesos legítimos utilizados por los formularios actuales.

### Riesgos de incompatibilidad

| Riesgo | Evaluación | Mitigación |
|---|---|---|
| Cuenta antigua sin `status: active` | Podría quedar sin escrituras sensibles | Las cuentas observadas usan estado activo; revisar cuentas antiguas antes del despliegue |
| Membresía antigua con ID distinto de `organizacion_usuario` | El responsable podría no ser reconocido | Comprobar membresías existentes; el alta actual usa el ID esperado |
| Habilidad antigua fuera de las ocho categorías finales | Se conserva en lectura, pero no puede volver a incrementarse | No se borra información; las nuevas verificaciones usan el catálogo actual |
| Cliente desactualizado que envíe más de tres habilidades | La operación será rechazada | La interfaz preparada limita y deshabilita la cuarta selección |
| Documento inconsistente previo al despliegue | Puede no admitir nuevas transiciones | Revisar solo los registros anómalos; las reglas no los modifican automáticamente |

### Procedimiento de publicación propuesto

1. Confirmar rama limpia y commit final.
2. Ejecutar nuevamente las 27 pruebas del emulador.
3. Ejecutar el modo de simulación de Firebase.
4. Publicar exclusivamente reglas:

   `npx firebase-tools deploy --only firestore:rules --project red-cercana-tao`

5. Confirmar en consola la nueva versión de reglas.
6. Realizar una lectura pública, una lectura administrativa y un recorrido controlado con cuentas de prueba.
7. No publicar Hosting ni Functions dentro de la misma operación.

El modo de simulación ya compiló correctamente `firestore.rules` para `red-cercana-tao` sin desplegar cambios.

### Estrategia de reversión

1. Conservar el commit previo `1436e6c`, correspondiente a las reglas anteriores a la auditoría.
2. Si aparece un bloqueo legítimo, volver temporalmente a esa versión de `firestore.rules` desde Git.
3. Publicar nuevamente **solo** `firestore:rules`.
4. Documentar el caso bloqueado, corregirlo y repetir el emulador antes de un nuevo despliegue.

La reversión tampoco modifica datos; solo reemplaza el conjunto de reglas activo. Debe utilizarse como medida de emergencia porque la versión anterior reabre los problemas de seguridad corregidos.

## B. Historias de usuario

| HU | Función | Evidencia actual | Estado final | Limitación |
|---|---|---|---|---|
| HU-01 | Inicio con Google | Sesión real recuperada en producción; errores y cancelación manejados; bootstrap probado con Firestore emulado | **Parcial** | No se repitió en esta etapa un alta desde cero ni el selector real de Google |
| HU-02 | Perfil del voluntario | Formulario obligatorio, validación, alta vacía segura, edición y persistencia probadas | **Verificada por integración** | No se creó un perfil nuevo en producción |
| HU-03 | Perfil de organización | Alta, membresía propietaria, campos obligatorios, edición y estado pendiente probados | **Verificada por integración** | No se creó una organización nueva en producción |
| HU-04 | Publicar oportunidades | Creación y edición permitidas a organización verificada; pendiente bloqueada; catálogo y detalle visibles en producción | **Verificada** | No se creó una publicación real durante la prueba |
| HU-05 | Datos de compatibilidad | Perfil y oportunidad estructurados con los cinco criterios | **Verificada** | Depende de la calidad de los datos cargados |
| HU-06 | Cálculo de compatibilidad | Fórmula y casos borde con 10/10 pruebas | **Verificada** | No depende de OpenAI |
| HU-07 | Relaciones mediante IA | Callable, autenticación, secreto, modelo, esquema, validación y fallback comprobados | **Implementada técnicamente; validación externa pendiente** | No existe respuesta exitosa verificable por falta de saldo |
| HU-08 | Recomendaciones | Ordenamiento, actualización y valores 0-100 probados | **Verificada** | La explicación externa es opcional |
| HU-09 | Explicación | Explicación local siempre disponible; OpenAI no altera el porcentaje | **Verificada** | Texto de GPT-5 mini pendiente de validación exitosa |
| HU-10 | Manifestar interés | Botón y detalle inspeccionados; creación no duplicable; organización, rol y correo validados | **Verificada** | La escritura se probó en entorno aislado, no en producción |
| HU-11 | Confirmar vinculación | Aceptación y rechazo; match solo con solicitud o invitación aceptada | **Verificada** | Sin escritura de producción |
| HU-12 | Registrar participación | Participación única asociada a voluntario, organización y oportunidad | **Verificada** | Sin escritura de producción |
| HU-13 | Tareas, habilidades y devolución | Tareas obligatorias, máximo tres habilidades, devolución vinculada y moderación | **Verificada** | Las horas no forman parte de los criterios de esta HU |
| HU-14 | Actualizar perfil y recomendaciones | Experiencia persistida, nivel incrementado una vez y recálculo 55 % -> 90 % | **Verificada** | Recorrido visual completo pendiente de grabación |

**Resumen:** 12 historias tienen evidencia funcional suficiente. HU-01 conserva una validación manual pendiente. HU-07 está implementada técnicamente, pero la respuesta exitosa del servicio externo continúa pendiente.

## C. Compatibilidad

### Algoritmo real

`C = redondear(H × 0,30 + I × 0,20 + D × 0,20 + U × 0,15 + E × 0,15)`

Cada criterio se mantiene entre 0 y 100.

### Ponderación interna de habilidades

| Datos disponibles | Comportamiento real |
|---|---|
| Declaradas y verificadas | `redondear(Hd × 0,35 + Hv × 0,65)` |
| Solo declaradas | Se utiliza `Hd` completo |
| Solo verificadas | Se utiliza `Hv` completo |
| Ninguna, con habilidades requeridas | 0 |
| La oportunidad no requiere habilidades | 100 |

Este comportamiento es coherente con el objetivo del prototipo: una persona nueva no recibe una penalización interna adicional por no tener todavía verificaciones. El peso de la trayectoria ya se refleja por separado en el criterio de experiencias, que vale 0 mientras no existan antecedentes.

No se modificó el algoritmo. La tesis debe describir esta regla condicional de manera explícita.

### Caso principal reproducible 55 % -> 90 %

**Perfil inicial:**

- ubicación: Córdoba capital;
- interés: Ambiente;
- disponibilidad: sábado por la mañana;
- habilidad declarada: Cocina y alimentación;
- habilidades verificadas: ninguna;
- experiencias: ninguna.

**Oportunidad:**

- categoría: Ambiente;
- habilidad requerida: Naturaleza y ambiente;
- disponibilidad: sábado por la mañana;
- modalidad presencial;
- ubicación: Córdoba capital.

**Antes:**

| Criterio | Valor | Aporte ponderado |
|---|---:|---:|
| Habilidades | 0 | 0 |
| Intereses | 100 | 20 |
| Disponibilidad | 100 | 20 |
| Ubicación | 100 | 15 |
| Experiencia | 0 | 0 |
| **Total** | | **55** |

Después se registró una participación completada, la tarea `Preparar huerta`, la habilidad verificada `Naturaleza y ambiente` y la experiencia relacionada.

**Después:**

| Criterio | Valor | Aporte ponderado |
|---|---:|---:|
| Habilidades | 65 | 19,5 |
| Intereses | 100 | 20 |
| Disponibilidad | 100 | 20 |
| Ubicación | 100 | 15 |
| Experiencia | 100 | 15 |
| **Total sin redondear** | | **89,5** |
| **Total final** | | **90** |

La prueba crea la postulación, la acepta, crea la vinculación, registra la participación, guarda la devolución, actualiza el perfil, vuelve a leer Firestore y recalcula el porcentaje con el motor real.

### Diferencia con el caso narrado actualmente en la tesis

La tesis describe un perfil con dos de tres habilidades requeridas declaradas, coincidencia de interés y ubicación, y dos de tres disponibilidades. Bajo el algoritmo actual, cuando solo existen habilidades declaradas, estas se utilizan completas. Por lo tanto, ese perfil no reproduce 55 %: su resultado aproximado es 69 %.

El 55 % de la redacción surge de aplicar solo el 35 % a las habilidades declaradas aun cuando no existen verificadas, regla que no coincide con el código. No deben presentarse ambos escenarios como la misma prueba.

**Evidencia principal recomendada:** utilizar el caso integrado de huerta detallado anteriormente, porque coincide con el código y prueba también la persistencia en Firestore.

## D. Recorridos funcionales

### Recorrido integral aislado

| Paso | Resultado | Evidencia |
|---|---|---|
| Preparar voluntario | Aprobado | Usuario activo y perfil inicial aislado |
| Preparar organización | Aprobado | Organización verificada y membresía propietaria |
| Publicar oportunidad | Aprobado | Oportunidad pública de huerta |
| Consultar recomendación inicial | Aprobado | 55 % |
| Postular voluntario | Aprobado | Solicitud y notificación persistidas |
| Aceptar solicitud | Aprobado | Estado aceptado y notificación |
| Registrar vinculación | Aprobado | Match confirmado y consistente |
| Registrar participación | Aprobado | Participación completada única |
| Guardar tareas y habilidades | Aprobado | Feedback y habilidad verificada persistidos |
| Actualizar perfil | Aprobado | Experiencia agregada y contador incrementado |
| Recalcular | Aprobado | Desglose 65/100/100/100/100 |
| Comprobar nuevo porcentaje | Aprobado | 90 % |

### Evidencia desde la interfaz

Se inspeccionaron en la aplicación publicada, sin realizar escrituras:

- sesión real recuperada como administrador;
- catálogo de oportunidades;
- filtros por provincia y modalidad;
- detalle real de una oportunidad;
- tareas y habilidades requeridas;
- privacidad de la dirección exacta;
- botón de interés;
- panel administrativo, validación, moderación, devoluciones y ausencias.

La escritura completa se verificó mediante Firestore emulado. No se crearon cuentas, oportunidades ni solicitudes en producción.

### Funciones complementarias

| Función | Clasificación | Decisión para Entrega 4 |
|---|---|---|
| Cancelación autónoma previa | Versión posterior | Actualmente se informa contacto y aviso mínimo; no forma parte de las 14 HU |
| Horas verificadas | Campo preparado, función no utilizada | No se muestra como resultado real ni es requisito de HU-13; no ampliar el alcance |
| Filtro avanzado de voluntarios | Versión posterior | La organización puede consultar e invitar perfiles visibles; no es criterio de las HU |

## E. Infraestructura

### Firestore

- Proyecto: `red-cercana-tao`.
- Base: `(default)`.
- Región: `southamerica-east1`.
- Reglas reforzadas: preparadas y compiladas, pendientes de autorización para desplegar.
- Datos reales: no modificados.

### Respaldos

- Programación nativa diaria activa.
- Conservación: 7 días.
- Región: `southamerica-east1`.
- Dos respaldos se comprobaron en estado `READY` durante la auditoría.
- No se ejecutó ninguna restauración.

**Procedimiento seguro de restauración:** seleccionar un respaldo válido, utilizar una cuenta con el rol específico de restauración, restaurar en una base nueva, comprobar integridad y reglas en esa base aislada y recién después planificar una migración controlada. Nunca debe restaurarse directamente sobre la base productiva sin una ventana, validación y plan de reversión.

**Texto académico propuesto:**

> Se configuraron copias de seguridad automáticas diarias de Cloud Firestore con una conservación de siete días y almacenamiento en la misma región de la base de datos. Durante la verificación se comprobaron dos respaldos disponibles en estado correcto. El acceso quedó restringido a cuentas con permisos administrativos. No se ejecutó una restauración sobre producción; este procedimiento quedó definido para realizarse primero en una base nueva y aislada, con el fin de validar la integridad de la información antes de cualquier recuperación operativa.

### Diferencias entre local y producción

- Hosting continúa con la interfaz publicada anterior a estos cambios finales.
- Las reglas reforzadas no están desplegadas.
- La limitación visual de tres habilidades y el texto correcto para roles no voluntarios tampoco están publicados.
- OpenAI no fue modificado ni invocado.

## F. Planificación

### Story Points, días y Gantt

- Los Story Points del Product Backlog representan complejidad relativa.
- Los días del Sprint Backlog son estimaciones de duración.
- Las fechas del Gantt son planificación de calendario.
- No existe una conversión automática entre estas tres medidas.
- HU-06, HU-07 y HU-14 tienen 13 Story Points, pero 11, 12 y 11 días respectivamente; el propio documento demuestra que no se usó una equivalencia directa.
- El historial Git comienza el 22 de octubre y no permite demostrar como tiempos reales las actividades planificadas desde agosto.
- Los commits respaldan existencia y evolución de funcionalidades, no horas ni duración histórica.

### Contradicciones detectadas

1. En el Gantt, la actividad 9 comienza el 22/09/2026, dura 12 días y figura con finalización `03/09/2026`. El mes final debe revisarse; por la secuencia y la barra corresponde `03/10/2026`.
2. Varias actividades se superponen aun cuando la columna indica una predecesora que todavía no finalizó. Debe aclararse que la dependencia representa disponibilidad parcial de insumos y trabajo iterativo, o corregir las dependencias si se pretendía una relación estricta fin-a-inicio.
3. El estado `Hecho` de HU-07 describe implementación técnica, no una respuesta exitosa actual de OpenAI.
4. Los días deben denominarse estimaciones planificadas y no duración real comprobada.

**Párrafo metodológico propuesto:**

> Los Story Points se utilizaron para estimar la complejidad relativa de las historias de usuario, mientras que los días de los Sprint Backlogs y las fechas del diagrama de Gantt representaron estimaciones temporales de planificación. Por este motivo, no se estableció una equivalencia directa entre puntos y días. Algunas actividades se superpusieron porque el desarrollo se realizó de forma iterativa y ciertos trabajos pudieron comenzar cuando ya se encontraban disponibles los insumos necesarios, aunque otras tareas relacionadas todavía continuaran en ejecución. Estas duraciones fueron planificadas y no deben interpretarse como un registro exacto de horas trabajadas.

## G. Correcciones técnicamente necesarias en la tesis

| Prioridad | Página | Apartado | Texto o idea actual | Texto propuesto | Justificación |
|---|---:|---|---|---|---|
| Alta | 27-28 | Habilidades | La fórmula 35/65 se aplica siempre y, sin verificadas, las declaradas aportan solo 35 % | “Cuando existen habilidades declaradas y verificadas, se combinan con pesos de 35 % y 65 %. Si solo existe una fuente, se utiliza su coincidencia completa. Si no existe ninguna y la oportunidad exige habilidades, el criterio vale 0.” | Coincide con `calculateCompatibility` |
| Alta | 29 | Caso 1 | Perfil nuevo con coincidencia completa obtiene 66 % y habilidades 35 | “El resultado esperado y obtenido fue 85 %, con 100 en habilidades, intereses, disponibilidad y ubicación, y 0 en experiencias.” | El código no penaliza dos veces a perfiles nuevos |
| Alta | 30-31 | Cambio 55 % -> 90 % | Dos de tres habilidades declaradas y dos de tres horarios producen 55 % | Sustituir por el caso de huerta reproducible detallado en la sección C de este informe | El caso actual produce aproximadamente 69 % con el algoritmo real |
| Alta | 50 | Arquitectura/OpenAI | “La respuesta ... pasa por una validación antes de utilizarse” sin diferenciar validación local y respuesta real | “La integración quedó preparada para validar respuestas JSON estructuradas y conservar el resultado determinista ante errores. La solicitud llegó al servicio externo, pero la respuesta exitosa quedó pendiente por falta de saldo.” | No afirmar un resultado externo no comprobado |
| Alta | 53 | Política de respaldo | “La configuración ... queda pendiente de implementación” | Reemplazar por el párrafo académico de respaldos incluido en la sección E | Los respaldos diarios ya están activos y existen copias `READY` |
| Alta | 17 | Gantt, actividad 9 | Fecha final `03/09/2026` | Revisar y corregir a `03/10/2026` | Inicio 22/09, duración 12 días y secuencia del gráfico |
| Media | 40-42 | Sprint Backlogs | Todas las HU figuran `Hecho` sin definición del estado | Agregar: “Hecho indica que la implementación técnica fue completada; las validaciones externas pendientes se informan por separado.” | Distingue implementación de comprobación productiva |
| Media | 40-42 | Estimaciones | “8 Días”, “12 Días”, etc. sin metodología explícita | Incorporar el párrafo metodológico de la sección F | Evita convertir Story Points en días o presentarlos como tiempos reales |
| Media | 42 | Estructura de datos | “se definirá una estructura de datos” | “se definió una estructura de datos” | La estructura ya está implementada |
| Media | 52 | Seguridad | Políticas redactadas parcialmente en futuro | Pasar a pasado o presente las políticas efectivamente implementadas | Mantener coherencia temporal con el prototipo terminado |
| Baja | 31 | Evidencia del caso | “resta verificar este mismo recorrido desde la interfaz” | Mantener, agregando que el recorrido completo ya fue verificado con Firestore emulado | Diferencia evidencia integrada de evidencia visual |

No es necesario reescribir las conclusiones: actualmente describen el propósito y el aprendizaje sin afirmar una respuesta exitosa de OpenAI.

## H. Cambios de código y pruebas

### Archivos modificados en esta etapa

| Archivo | Cambio |
|---|---|
| `firestore.rules` | Roles activos, alta segura, relaciones consistentes, habilidades limitadas y permisos administrativos |
| `scripts/firestore-rules.test.mjs` | Altas, ediciones, ataques, administración y recorrido integral |
| `lib/firebase-service.ts` | Validación defensiva del máximo de tres habilidades y duplicados |
| `app/page.tsx` | Máximo visible de tres habilidades y acción de interés limitada visualmente al rol voluntario |
| `docs/correcciones-finales-tfg-2026-11-08.md` | Evidencia, despliegue, tesis y resultados finales |

### Puntos de recuperación en Git

- `0e6923e`: auditoría técnica y base de esta etapa.
- `a54acf3`: refuerzo de seguridad, límites de habilidades y recorrido integrado.
- `b1108ef`: comprobación final de roles, formularios legítimos y moderación.

Todos permanecen en la rama `codex/final-tfg-corrections`. No se publicó ninguno en Firebase.

### Pruebas finales

| Grupo | Resultado |
|---|---:|
| Linter | Aprobado |
| TypeScript y compilación de producción | Aprobado |
| Motor de recomendaciones | 10/10 |
| Firestore e integración | 27/27 |
| Vía | 5/5 |
| Validación semántica local | 2/2 |
| **Total automatizado** | **44/44** |

### Pendientes reales

1. Autorizar y ejecutar el despliegue independiente de `firestore.rules`.
2. Repetir un alta real desde el selector de Google con una cuenta de prueba nueva.
3. Validar una respuesta exitosa de GPT-5 mini cuando exista saldo, sin cambiar modelo ni arquitectura.
4. Grabar el recorrido visual completo para la evidencia de la Entrega 4.
5. Corregir el PDF o Google Docs utilizando las redacciones propuestas, sin alterar resultados comprobados.

## Conclusión

El núcleo funcional quedó comprobado mediante 44 pruebas automatizadas. El recorrido completo desde la postulación hasta la actualización de recomendaciones se reprodujo en un entorno aislado y obtuvo 55 % antes de la experiencia y 90 % después. Las nuevas reglas conservan los accesos legítimos y rechazan escaladas, suplantaciones e incrementos de habilidades inválidos. La publicación de seguridad está preparada como una operación independiente, pero continúa pendiente de autorización expresa. OpenAI no bloquea la aplicación: la integración técnica está implementada, mientras que el motor determinista y la explicación local permanecen operativos.
