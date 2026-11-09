export type TutorialRole = "volunteer" | "organization";
export type TutorialScreen = "landing" | "opportunities" | "volunteer" | "organization" | "admin";

export type ViaTourState = "idle" | "greeting" | "talking" | "explanation" | "waiting" | "thinking" | "celebration" | "farewell";

export type ViaTourStep = {
  title: string;
  text: string;
  target: string;
  screen: TutorialScreen;
  state?: ViaTourState;
  actionTarget?: string;
  actionLabel?: string;
  actionHint?: string;
};

export const VIA_WELCOME_DIALOGUES: Record<TutorialRole, Array<{ text: string; state: ViaTourState }>> = {
  volunteer: [
    { text: "¡Hola! Soy Vía. ¡Qué bueno que estés acá!", state: "greeting" },
    { text: "En Voluntariando hay muchas formas de ayudar. Yo voy a acompañarte para encontrar las que mejor conecten con vos.", state: "talking" },
    { text: "Primero te muestro lo esencial y después recorremos la aplicación juntos. ¿Vamos?", state: "explanation" },
  ],
  organization: [
    { text: "¡Hola! Soy Vía. ¡Qué bueno recibir a tu organización!", state: "greeting" },
    { text: "Voy a acompañarlos para publicar oportunidades claras, conocer voluntarios y registrar cada experiencia.", state: "talking" },
    { text: "Primero te muestro lo esencial y después recorremos la aplicación juntos. ¿Vamos?", state: "explanation" },
  ],
};

// Estos videos corresponden a acciones que existen realmente en la aplicación.
export const VIA_VIDEO_STEPS = [
  { title: "Creá y completá tu perfil", text: "Tus intereses, habilidades, disponibilidad y ubicación ayudan a encontrar oportunidades que tengan sentido para vos.", videoSrc: "/videos/crear-perfil.mp4" },
  { title: "Entendé tus recomendaciones", text: "Cada porcentaje resume cuánto coincide una oportunidad con tu perfil. Vía te ayuda a entender por qué puede ser una buena opción.", videoSrc: "/videos/recibir-recomendaciones.mp4" },
  { title: "Mostrá interés y vinculáte", text: "Cuando una propuesta te guste, podés mostrar interés. El contacto se habilita después de la aceptación.", videoSrc: "/videos/mostrar-interes.mp4" },
  { title: "Sumá una experiencia verificada", text: "La organización registra las tareas y habilidades observadas. Eso fortalece tu trayectoria y las próximas recomendaciones.", videoSrc: "/videos/sumar-experiencia.mp4" },
] as const;

const VOLUNTEER_STEPS: ViaTourStep[] = [
  { title: "Tu perfil", text: "Acá registrás intereses, habilidades, disponibilidad y ubicación. Probá abrir la edición: voy a esperar tu acción.", target: "volunteer-profile", screen: "volunteer", state: "explanation", actionTarget: "volunteer-edit-profile", actionLabel: "Abrir mi perfil", actionHint: "Cuando se abra, continuamos automáticamente." },
  { title: "Oportunidades disponibles", text: "Este buscador te permite explorar propuestas reales. Tocá el campo para probarlo y seguimos.", target: "opportunity-feed", screen: "opportunities", state: "greeting", actionTarget: "opportunity-search", actionLabel: "Probar el buscador", actionHint: "No hace falta escribir nada todavía." },
  { title: "Recomendaciones para vos", text: "El porcentaje muestra cuánto coincide cada propuesta con tus intereses y experiencia. Las opciones más cercanas a vos aparecen primero.", target: "volunteer-recommendations", screen: "volunteer", state: "thinking" },
  { title: "Postulaciones e invitaciones", text: "Podés mostrar interés o responder propuestas directas. El contacto se habilita únicamente cuando existe aceptación.", target: "volunteer-invitations", screen: "volunteer", state: "talking" },
  { title: "Participaciones", text: "Desde tus solicitudes seguís cada vínculo confirmado y luego consultás si la experiencia fue completada o quedó en revisión.", target: "volunteer-applications", screen: "volunteer", state: "explanation" },
  { title: "Experiencias verificadas", text: "Las tareas y habilidades observadas quedan en tu trayectoria y pueden mejorar futuras recomendaciones.", target: "volunteer-experiences", screen: "volunteer", state: "celebration" },
];

const ORGANIZATION_STEPS: ViaTourStep[] = [
  { title: "Perfil de la organización", text: "La descripción, ubicación y contacto generan confianza. Abrí la edición para reconocer dónde se actualizan.", target: "organization-profile", screen: "organization", state: "explanation", actionTarget: "organization-edit-profile", actionLabel: "Abrir el perfil", actionHint: "Solo vamos a abrirlo; no se guardará ningún cambio." },
  { title: "Publicar oportunidades", text: "Acá se definen tareas, requisitos, habilidades y modalidad. Probá abrir una nueva publicación.", target: "organization-opportunities", screen: "organization", state: "talking", actionTarget: "organization-new-opportunity", actionLabel: "Ver dónde publicar", actionHint: "Si la validación está pendiente, te mostraré dónde se habilitará." },
  { title: "Encontrar voluntarios", text: "Consultá únicamente los perfiles que autorizaron ser visibles y enviá invitaciones desde esta sección.", target: "organization-volunteers", screen: "organization", state: "greeting" },
  { title: "Invitaciones enviadas", text: "Podés seguir cada propuesta directa hasta que la persona la acepte o la rechace.", target: "organization-invitations", screen: "organization", state: "explanation" },
  { title: "Postulaciones y participaciones", text: "Revisá las solicitudes, aceptá o rechazá y registrá la experiencia realizada o una ausencia.", target: "organization-applications", screen: "organization", state: "thinking" },
  { title: "Tareas y habilidades verificadas", text: "Al finalizar, detallá qué hizo la persona y qué habilidades observaste. Esa evidencia actualiza su trayectoria.", target: "organization-applications", screen: "organization", state: "celebration" },
];

export const VIA_TOUR_STEPS: Record<TutorialRole, ViaTourStep[]> = {
  volunteer: VOLUNTEER_STEPS,
  organization: ORGANIZATION_STEPS,
};

// La versión forma parte de la clave para volver a mostrar recorridos renovados.
export function viaWelcomeStorageKey(userId: string) {
  return `voluntariando-via-welcome-${userId}-v3`;
}

export function viaTutorialStorageKey(userId: string, role: TutorialRole) {
  return `voluntariando-tutorial-${userId}-${role}-v4`;
}

export function viaMilestoneStorageKey(userId: string, role: TutorialRole) {
  return `voluntariando-via-first-link-${userId}-${role}-v3`;
}
