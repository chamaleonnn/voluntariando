# Configuración de Firebase

## Proyecto utilizado

- ID: `red-cercana-tao`
- Hosting: https://voluntariando.web.app
- Región de Firestore: `southamerica-east1`
- Administrador inicial: `leybatao014@gmail.com`

## Servicios

- **Authentication:** proveedor Google.
- **Cloud Firestore:** datos de usuarios, perfiles, organizaciones y experiencias.
- **Hosting:** exportación estática de Next.js.
- **Storage:** preparado para fotos, pendiente de habilitación por permisos/facturación.
- **Cloud Functions:** función preparada para procesar devoluciones aprobadas con IA; requiere plan Blaze y `OPENAI_API_KEY`.

## Variables locales

El archivo `.env.local` contiene solamente la configuración pública de la aplicación web de Firebase:

```text
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=red-cercana-tao.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=red-cercana-tao
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=red-cercana-tao.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

La clave de OpenAI nunca debe guardarse en el frontend. Cuando se habiliten Functions:

```bash
npx firebase-tools functions:secrets:set OPENAI_API_KEY
npx firebase-tools deploy --only functions,storage
```

## Despliegue habitual

```bash
npm run verify
npx firebase-tools deploy --only auth,firestore,hosting
```

Las reglas de Firestore aplican los permisos en el servidor. Ocultar un botón en la interfaz no se considera una medida de seguridad.
