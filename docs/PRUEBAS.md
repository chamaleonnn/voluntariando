# Plan de pruebas

## Verificación automática

```bash
npm run verify
```

Comprueba lint, tipos, compilación de producción y sintaxis de la función.

## Recorridos funcionales

### Público

- La landing aparece antes del acceso.
- El catálogo muestra solamente oportunidades públicas y publicadas.
- Búsqueda, provincia, modalidad y mapa permiten explorar sin iniciar sesión.
- La dirección exacta permanece protegida.

### Voluntario

- Google crea una cuenta y su perfil.
- Puede editar ubicación, intereses, habilidades y disponibilidad.
- Ve recomendaciones ordenadas, porcentaje, desglose y explicación.
- Mostrar interés crea una única solicitud.
- Ve el estado de sus solicitudes y la trayectoria verificada.

### Organización

- Google crea una cuenta y el perfil de organización.
- Puede editar el perfil y publicar o modificar oportunidades.
- Puede aceptar o rechazar personas interesadas.
- Puede marcar una experiencia realizada y registrar tareas y habilidades observadas.

### Administración

- El correo autorizado del proyecto puede ingresar como primer administrador con Google.
- Un administrador puede promover otra cuenta al rol administrador.
- Ve cuentas, correos, roles y estados desde Firebase.
- Puede corregir el nombre visible de una cuenta.
- Puede suspenderla por una cantidad definida de días y registrar el motivo.
- Puede reactivar una cuenta sin borrar su historial.
- Puede corregir, ocultar y restaurar oportunidades.
- Cada cambio crea un registro inmutable en `adminActions`.
- El administrador no puede suspender su propia cuenta desde la interfaz.

### Recomendación

- Las ponderaciones suman 100 %.
- Las habilidades verificadas pesan más que las declaradas.
- La IA no modifica el porcentaje ni agrega datos inexistentes.

## Pendiente de infraestructura

- Probar la explicación semántica real después de desplegar Functions y configurar `OPENAI_API_KEY`.
