# Guiones de captura - tutoriales Voluntariando

Estado: producidos y validados localmente. Los cuatro videos mejorados están en `public/videos/`, duran 15 segundos y conservan los nombres usados por la landing. Los archivos anteriores permanecen como respaldo en `public/videos/originales/`.

## Especificación común

- Formato: MP4 H.264, 1280×720, 30 fps, sin audio, 15 segundos.
- Presentación: recorrido gráfico fiel a las acciones reales, sin pantallas ni funciones inexistentes.
- Subtítulos: integrados en zona inferior segura, máximo dos líneas, blanco sobre placa oscura semitransparente.
- Inicio/cierre: Vía aparece 1 segundo con el título; cierre de 1 segundo con “Podés repetir este recorrido desde ?”.
- Personaje: se conserva el PNG original de Vía y se utiliza una variante con el pañuelito integrado en el mismo acabado 3D, además de balanceo, parpadeo y habla visual. No hay audio ni se declara sincronización labial real.
- Móvil: textos dentro del 80 % central y peso mínimo equivalente a 24 px en 720p.

## 1. Crear y completar el perfil

Propósito: explicar qué datos alimentan las recomendaciones.

1. Entrar como voluntario demo y abrir `Mi espacio`.
2. Pulsar `Editar perfil`.
3. Recorrer ubicación, intereses, habilidades, disponibilidad, privacidad y redes opcionales.
4. Guardar y volver al panel.

Subtítulos: “Completá tus intereses y habilidades” → “Elegí quién puede encontrar tu perfil” → “Estos datos alimentan la compatibilidad”.

## 2. Recibir y entender recomendaciones

Propósito: mostrar el motor compartido con Vía.

1. Abrir oportunidades desde un perfil voluntario completo.
2. Mostrar el orden por compatibilidad.
3. Abrir una tarjeta y detenerse en el desglose de cinco criterios.
4. Abrir Vía, responder causa/modalidad y mostrar la oportunidad real sugerida.

Subtítulos: “Mayor compatibilidad primero” → “Cinco criterios, un resultado explicable” → “Vía usa el mismo motor”.

## 3. Manifestar interés y concretar una vinculación

Propósito: explicar postulación, respuesta y contacto posterior.

1. Abrir una oportunidad y pulsar `Me interesa`.
2. Cambiar a organización demo y mostrar la solicitud pendiente.
3. Pulsar `Aceptar`.
4. Volver al voluntario y mostrar estado confirmado y contacto habilitado.

Subtítulos: “Mostrá interés” → “La organización decide” → “El contacto se habilita después del match”.

## 4. Registrar experiencia y actualizar habilidades

Propósito: demostrar el ciclo académico central.

1. Como organización, abrir una participación aceptada y pulsar `Marcar realizada`.
2. Detallar tareas y seleccionar habilidades observadas.
3. Completar la participación.
4. Volver al perfil voluntario y mostrar experiencia y habilidades verificadas.
5. Mostrar brevemente una recomendación actualizada.

Subtítulos: “La organización registra tareas reales” → “Solo verifica habilidades observadas” → “La trayectoria mejora futuras recomendaciones”.

## Videos adicionales propuestos

### Organización: publicar e invitar (15 s)

Perfil validado → `Nueva oportunidad` → completar tareas/habilidades → publicar → elegir voluntario visible → enviar invitación. Subtítulo final: “El match se crea cuando la persona acepta”.

### Conocé a Vía (12 s)

Estados saludo → explicación → pensamiento → celebración; mostrar minimización, reapertura y pregunta “¿Todavía no decidís dónde ayudar?”. Subtítulo final: “Vía orienta; el algoritmo conserva el control del porcentaje”.

## Actualización realizada

Los cuatro MP4 abren correctamente, tienen duración y textos integrados, explican únicamente funciones reales y cuentan con pósteres actualizados. El contenido principal no se alteró; se añadieron únicamente las capas animadas de Vía. El generador reproducible queda en `scripts/generate-tutorial-videos.py` y los originales en `public/videos/originales/`.
