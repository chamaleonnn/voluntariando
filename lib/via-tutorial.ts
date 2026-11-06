export type TutorialRole = "volunteer" | "organization";
export type TutorialScreen = "landing" | "opportunities" | "volunteer" | "organization" | "admin";

export type ViaTourState = "idle" | "greeting" | "talking" | "explanation" | "waiting" | "thinking" | "celebration" | "farewell";

export type ViaTourStep = {
  title: string;
  text: string;
  target: string;
  screen: TutorialScreen;
  state?: ViaTourState;
};

// Estos videos corresponden a acciones que existen realmente en la aplicación.
export const VIA_VIDEO_STEPS = [
  { title: "Creá y completá tu perfil", text: "Tus intereses, habilidades, disponibilidad y ubicación ayudan a encontrar oportunidades que tengan sentido para vos.", videoSrc: "/videos/crear-perfil.mp4" },
  { title: "Entendé tus recomendaciones", text: "Cada porcentaje combina cinco criterios. El motor propio mantiene el cálculo y Vía te ayuda a entender el resultado.", videoSrc: "/videos/recibir-recomendaciones.mp4" },
  { title: "Mostrá interés y vinculáte", text: "Cuando una propuesta te guste, podés mostrar interés. El contacto se habilita después de la aceptación.", videoSrc: "/videos/mostrar-interes.mp4" },
  { title: "Sumá una experiencia verificada", text: "La organización registra las tareas y habilidades observadas. Eso fortalece tu trayectoria y las próximas recomendaciones.", videoSrc: "/videos/sumar-experiencia.mp4" },
] as const;

const VOLUNTEER_STEPS: ViaTourStep[] = [
  { title: "Tu perfil", text: "Acá registrás intereses, habilidades, disponibilidad y ubicación. Son los datos que utiliza el motor para recomendarte oportunidades.", target: "volunteer-profile", screen: "volunteer", state: "explanation" },
  { title: "Oportunidades disponibles", text: "En este espacio explorás propuestas reales, usás filtros y abrís cada oportunidad para conocer sus tareas.", target: "opportunity-feed", screen: "opportunities", state: "greeting" },
  { title: "Compatibilidad y recomendaciones", text: "El porcentaje combina cinco criterios explicables. Las oportunidades con mayor coincidencia aparecen primero.", target: "volunteer-recommendations", screen: "volunteer", state: "thinking" },
  { title: "Postulaciones e invitaciones", text: "Podés mostrar interés o responder propuestas directas. El contacto se habilita únicamente cuando existe aceptación.", target: "volunteer-invitations", screen: "volunteer", state: "talking" },
  { title: "Participaciones", text: "Desde tus solicitudes seguís cada vínculo confirmado y luego consultás si la experiencia fue completada o quedó en revisión.", target: "volunteer-applications", screen: "volunteer", state: "explanation" },
  { title: "Experiencias verificadas", text: "Las tareas y habilidades observadas quedan en tu trayectoria y pueden mejorar futuras recomendaciones.", target: "volunteer-experiences", screen: "volunteer", state: "celebration" },
];

const ORGANIZATION_STEPS: ViaTourStep[] = [
  { title: "Perfil de la organización", text: "Completá la descripción, ubicación y contacto. La validación administrativa protege a quienes participan.", target: "organization-profile", screen: "organization", state: "explanation" },
  { title: "Publicar oportunidades", text: "Definí tareas, requisitos, habilidades, modalidad y disponibilidad con información concreta.", target: "organization-opportunities", screen: "organization", state: "talking" },
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
  return `voluntariando-via-welcome-${userId}-v2`;
}

export function viaTutorialStorageKey(userId: string, role: TutorialRole) {
  return `voluntariando-tutorial-${userId}-${role}-v3`;
}
