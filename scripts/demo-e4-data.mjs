import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT_ID = "red-cercana-tao";
const JOAQUIN_UID = "VIi8qYq2XwYS1wmOXXVsrGZYjPr2";
const JOAQUIN_EMAIL = "joaquinsabina1412@gmail.com";
const PREFIX = "demo-e4-";
const mode = process.argv.includes("--seed") ? "seed" : process.argv.includes("--clean") ? "clean" : "plan";
const confirmedProject = process.argv.find((item) => item.startsWith("--confirm-project="))?.split("=")[1];

const image = {
  art: "https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1200&q=80",
  environment: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80",
  education: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=80",
  community: "https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1200&q=80",
};

function refreshFirebaseLogin() {
  execFileSync("npx", ["firebase-tools", "projects:list", "--json"], { stdio: "ignore" });
  const configPath = join(homedir(), ".config", "configstore", "firebase-tools.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  if (config.user?.email !== "leybatao014@gmail.com" || !config.tokens?.access_token) {
    throw new Error("Iniciá sesión en Firebase CLI con la cuenta administradora antes de continuar.");
  }
  return config.tokens.access_token;
}

const token = refreshFirebaseLogin();
const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function request(url, options = {}, allowMissing = false) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  if (allowMissing && response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore respondió ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

function value(input) {
  if (input === null || input === undefined) return { nullValue: null };
  if (input instanceof Date) return { timestampValue: input.toISOString() };
  if (Array.isArray(input)) return { arrayValue: { values: input.map(value) } };
  if (typeof input === "object") return { mapValue: { fields: fields(input) } };
  if (typeof input === "boolean") return { booleanValue: input };
  if (typeof input === "number") return Number.isInteger(input) ? { integerValue: String(input) } : { doubleValue: input };
  return { stringValue: String(input) };
}

function fields(input) {
  return Object.fromEntries(Object.entries(input).filter(([, item]) => item !== undefined).map(([key, item]) => [key, value(item)]));
}

function decode(input) {
  if (!input) return undefined;
  if ("nullValue" in input) return null;
  if ("stringValue" in input) return input.stringValue;
  if ("timestampValue" in input) return input.timestampValue;
  if ("integerValue" in input) return Number(input.integerValue);
  if ("doubleValue" in input) return input.doubleValue;
  if ("booleanValue" in input) return input.booleanValue;
  if ("arrayValue" in input) return (input.arrayValue.values ?? []).map(decode);
  if ("mapValue" in input) return Object.fromEntries(Object.entries(input.mapValue.fields ?? {}).map(([key, item]) => [key, decode(item)]));
  return undefined;
}

async function getDocument(path) {
  return request(`${base}/${path}`, {}, true);
}

async function listDocuments(collection) {
  const result = await request(`${base}/${collection}?pageSize=300`, {}, true);
  return (result?.documents ?? []).map((document) => ({
    id: document.name.split("/").at(-1),
    data: Object.fromEntries(Object.entries(document.fields ?? {}).map(([key, item]) => [key, decode(item)])),
  }));
}

async function putDocument(path, data) {
  await request(`${base}/${path}`, { method: "PATCH", body: JSON.stringify({ fields: fields(data) }) });
}

async function patchRaw(path, rawFields, fieldPaths) {
  const query = fieldPaths.map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`).join("&");
  await request(`${base}/${path}?${query}`, { method: "PATCH", body: JSON.stringify({ fields: rawFields }) });
}

async function deleteDocument(path) {
  await request(`${base}/${path}`, { method: "DELETE" }, true);
}

function opportunity(id, organizationId, organization, title, category, modality, availability, requiredSkills, imageUrl, status = "published") {
  return {
    id, organizationId, organization, title,
    description: `DEMO / Prueba académica. ${title} forma parte del escenario controlado para demostrar Voluntariando.`,
    tasks: ["Preparar materiales", "Acompañar la actividad", "Registrar lo realizado"],
    requirements: ["Compromiso", "Buen trato", "Trabajo en equipo"],
    date: "2026-11-21", dateLabel: "Sáb 21 nov", time: "15:00–18:00",
    neighborhood: modality === "Virtual" ? "Actividad virtual" : "Córdoba capital",
    addressHint: modality === "Virtual" ? "El enlace se comparte al confirmar." : "La dirección se comparte al confirmar la participación.",
    latitude: -31.4201, longitude: -64.1888, distanceKm: 2.5,
    capacity: 12, availableSpots: 6, category, province: "Córdoba", modality,
    availability, requiredSkills, imageUrl, imageUrls: [imageUrl], visibility: "public", status,
    simulated: true, createdAt: new Date("2026-11-09T18:00:00-03:00"), updatedAt: new Date(),
  };
}

function buildDemoDocuments(hasPreparedRequest) {
  const allyOrg = `${PREFIX}org-aliada`;
  const pendingOrg = `${PREFIX}org-pendiente`;
  const ana = `${PREFIX}vol-ana`;
  const lucas = `${PREFIX}vol-lucas`;
  const suspended = `${PREFIX}vol-suspendido`;
  const smartOpportunity = `${PREFIX}compatibilidad`;
  const pendingApplication = `${PREFIX}ambiente_${ana}`;
  const coreInvitation = `${PREFIX}invitacion-compatibilidad`;
  const coreMatch = `invitation_${coreInvitation}`;
  const createdAt = new Date("2026-11-09T18:30:00-03:00");
  const docs = new Map();
  const add = (path, data) => docs.set(path, data);

  add(`users/${ana}`, { email: "ana.demo@voluntariando.invalid", displayName: "Ana Demo", role: "volunteer", status: "active", createdAt });
  add(`users/${lucas}`, { email: "lucas.demo@voluntariando.invalid", displayName: "Lucas Demo", role: "volunteer", status: "active", createdAt });
  add(`users/${suspended}`, { email: "suspendido.demo@voluntariando.invalid", displayName: "Usuario DEMO suspendido", role: "volunteer", status: "suspended", suspensionReason: "DEMO / Dos devoluciones negativas confirmadas", suspendedUntil: new Date("2026-11-16T18:30:00-03:00"), createdAt });
  add(`users/${pendingOrg}`, { email: "organizacion.pendiente@voluntariando.invalid", displayName: "Puentes Barriales DEMO", role: "organization", status: "active", createdAt });
  add(`users/${allyOrg}`, { email: "organizacion.aliada@voluntariando.invalid", displayName: "Aula Abierta DEMO", role: "organization", status: "active", createdAt });

  add(`volunteerProfiles/${ana}`, { name: "Ana Demo", initials: "AD", location: "Córdoba", bio: "Perfil ficticio para la demostración académica.", completedExperiences: 1, verifiedHours: 4, interests: ["Ambiente", "Educación"], declaredSkills: ["Trabajo en equipo", "Cocina y alimentación"], verifiedSkills: { "Naturaleza y ambiente": 1 }, availability: ["Sábado por la mañana", "Flexible"], socialLinks: {}, experiences: [], visibleToOrganizations: true, visibleToVolunteers: true, updatedAt: createdAt });
  add(`volunteerProfiles/${lucas}`, { name: "Lucas Demo", initials: "LD", location: "Córdoba", bio: "Perfil ficticio para probar invitaciones y participaciones.", completedExperiences: 2, verifiedHours: 8, interests: ["Arte y cultura", "Educación"], declaredSkills: ["Creatividad", "Comunicación"], verifiedSkills: { "Arte y creatividad": 2, "Educación y acompañamiento": 1 }, availability: ["Sábado por la tarde", "Flexible"], socialLinks: {}, experiences: [], visibleToOrganizations: true, visibleToVolunteers: true, updatedAt: createdAt });
  add(`volunteerProfiles/${suspended}`, { name: "Usuario DEMO suspendido", initials: "DS", location: "Córdoba", bio: "Cuenta ficticia para mostrar sanciones.", completedExperiences: 2, verifiedHours: 6, interests: ["Asistencia comunitaria"], declaredSkills: ["Organización"], verifiedSkills: {}, availability: ["Flexible"], socialLinks: {}, experiences: [], visibleToOrganizations: false, visibleToVolunteers: false, updatedAt: createdAt });

  add(`organizations/${pendingOrg}`, { ownerId: pendingOrg, name: "Puentes Barriales DEMO", email: "organizacion.pendiente@voluntariando.invalid", contact: "organizacion.pendiente@voluntariando.invalid", province: "Córdoba", location: "Córdoba capital", description: "DEMO / Organización ficticia pendiente de validación administrativa.", areas: ["Educación", "Asistencia comunitaria"], imageUrl: image.education, socialLinks: {}, status: "pending", createdAt, updatedAt: createdAt });
  add(`organizations/${allyOrg}`, { ownerId: allyOrg, name: "Aula Abierta DEMO", email: "organizacion.aliada@voluntariando.invalid", contact: "organizacion.aliada@voluntariando.invalid", province: "Córdoba", location: "Córdoba capital", description: "DEMO / Organización ficticia utilizada para mostrar postulaciones del voluntario.", areas: ["Educación", "Arte y cultura"], imageUrl: image.education, socialLinks: {}, status: "verified", createdAt, updatedAt: createdAt });
  add(`organizationMembers/${pendingOrg}_${pendingOrg}`, { organizationId: pendingOrg, userId: pendingOrg, role: "owner", createdAt });
  add(`organizationMembers/${allyOrg}_${allyOrg}`, { organizationId: allyOrg, userId: allyOrg, role: "owner", createdAt });

  add(`opportunities/${smartOpportunity}`, opportunity(smartOpportunity, JOAQUIN_UID, "Comunidad Verde", "DEMO / Comunicación visual comunitaria", "Arte y cultura", "Presencial", ["Sábado por la tarde"], ["Tecnología y comunicación"], image.art));
  add(`opportunities/${PREFIX}ambiente`, opportunity(`${PREFIX}ambiente`, JOAQUIN_UID, "Comunidad Verde", "DEMO / Jornada de restauración ambiental", "Ambiente", "Presencial", ["Sábado por la mañana"], ["Naturaleza y ambiente", "Organización y logística"], image.environment));
  add(`opportunities/${PREFIX}educacion-virtual`, opportunity(`${PREFIX}educacion-virtual`, JOAQUIN_UID, "Comunidad Verde", "DEMO / Apoyo escolar virtual", "Educación", "Virtual", ["Miércoles por la tarde", "Flexible"], ["Educación y acompañamiento"], image.education));
  add(`opportunities/${PREFIX}postulacion-pendiente`, opportunity(`${PREFIX}postulacion-pendiente`, allyOrg, "Aula Abierta DEMO", "DEMO / Taller de lectura", "Educación", "Presencial", ["Sábado por la mañana"], ["Educación y acompañamiento"], image.education));
  add(`opportunities/${PREFIX}postulacion-rechazada`, opportunity(`${PREFIX}postulacion-rechazada`, allyOrg, "Aula Abierta DEMO", "DEMO / Clasificación de donaciones", "Asistencia comunitaria", "Presencial", ["Sábado por la tarde"], ["Organización y logística"], image.community));
  add(`opportunities/${PREFIX}moderacion`, opportunity(`${PREFIX}moderacion`, allyOrg, "Aula Abierta DEMO", "DEMO / Publicación pendiente de corrección", "Educación", "Híbrida", ["Flexible"], ["Tecnología y comunicación"], image.education, "draft"));

  if (!hasPreparedRequest) add(`applications/${pendingApplication}`, { id: pendingApplication, opportunityId: `${PREFIX}ambiente`, opportunityTitle: "DEMO / Jornada de restauración ambiental", organizationId: JOAQUIN_UID, userId: ana, userName: "Ana Demo", userEmail: "ana.demo@voluntariando.invalid", message: "Quiero participar", status: "pending", createdAt });
  add(`applications/${PREFIX}postulacion-pendiente_${JOAQUIN_UID}`, { id: `${PREFIX}postulacion-pendiente_${JOAQUIN_UID}`, opportunityId: `${PREFIX}postulacion-pendiente`, opportunityTitle: "DEMO / Taller de lectura", organizationId: allyOrg, userId: JOAQUIN_UID, userName: "Joaquin Sabina", userEmail: JOAQUIN_EMAIL, message: "Me interesa participar.", status: "pending", createdAt });
  add(`applications/${PREFIX}postulacion-rechazada_${JOAQUIN_UID}`, { id: `${PREFIX}postulacion-rechazada_${JOAQUIN_UID}`, opportunityId: `${PREFIX}postulacion-rechazada`, opportunityTitle: "DEMO / Clasificación de donaciones", organizationId: allyOrg, userId: JOAQUIN_UID, userName: "Joaquin Sabina", userEmail: JOAQUIN_EMAIL, message: "Me interesa participar.", status: "rejected", createdAt: new Date("2026-11-08T16:00:00-03:00") });

  add(`invitations/${coreInvitation}`, { id: coreInvitation, opportunityId: smartOpportunity, opportunityTitle: "DEMO / Comunicación visual comunitaria", organizationId: JOAQUIN_UID, organizationName: "Comunidad Verde", organizationContact: JOAQUIN_EMAIL, userId: JOAQUIN_UID, userName: "Joaquin Sabina", message: "DEMO / Participación preparada para registrar tareas y habilidades durante el video.", status: "accepted", createdAt });
  add(`invitations/${PREFIX}invitacion-pendiente`, { id: `${PREFIX}invitacion-pendiente`, opportunityId: `${PREFIX}educacion-virtual`, opportunityTitle: "DEMO / Apoyo escolar virtual", organizationId: JOAQUIN_UID, organizationName: "Comunidad Verde", organizationContact: JOAQUIN_EMAIL, userId: JOAQUIN_UID, userName: "Joaquin Sabina", message: "DEMO / Te invitamos a acompañar esta actividad.", status: "pending", createdAt: new Date("2026-11-09T19:00:00-03:00") });
  add(`invitations/${PREFIX}invitacion-rechazada`, { id: `${PREFIX}invitacion-rechazada`, opportunityId: `${PREFIX}ambiente`, opportunityTitle: "DEMO / Jornada de restauración ambiental", organizationId: JOAQUIN_UID, organizationName: "Comunidad Verde", organizationContact: JOAQUIN_EMAIL, userId: lucas, userName: "Lucas Demo", message: "DEMO / Invitación de prueba ya respondida.", status: "rejected", createdAt: new Date("2026-11-08T15:00:00-03:00") });
  add(`matches/${coreMatch}`, { invitationId: coreInvitation, opportunityId: smartOpportunity, opportunityTitle: "DEMO / Comunicación visual comunitaria", organizationId: JOAQUIN_UID, userId: JOAQUIN_UID, source: "invitation", status: "confirmed", createdAt });

  add(`notifications/${PREFIX}propuesta`, { recipientId: JOAQUIN_UID, actorId: JOAQUIN_UID, invitationId: `${PREFIX}invitacion-pendiente`, opportunityId: `${PREFIX}educacion-virtual`, type: "proposal_received", title: "DEMO / Nueva propuesta", message: "Comunidad Verde te invitó a una actividad de apoyo escolar.", read: false, createdAt: new Date("2026-11-09T19:00:00-03:00") });
  add(`notifications/${PREFIX}aceptada`, { recipientId: JOAQUIN_UID, actorId: allyOrg, applicationId: `${PREFIX}postulacion-pendiente_${JOAQUIN_UID}`, opportunityId: `${PREFIX}postulacion-pendiente`, type: "application_accepted", title: "DEMO / Participación confirmada", message: "Tu lugar quedó confirmado para el escenario académico.", read: false, createdAt: new Date("2026-11-09T18:50:00-03:00") });
  add(`notifications/${PREFIX}advertencia`, { recipientId: suspended, actorId: "demo-admin", feedbackId: `${PREFIX}feedback-pendiente`, type: "feedback_warning", title: "DEMO / Aspecto a mejorar", message: "Esta es una advertencia ficticia preparada para la demostración.", read: false, createdAt: new Date("2026-11-08T18:00:00-03:00") });

  add(`reviews/${PREFIX}resena-publica`, { applicationId: `${PREFIX}experiencia-previa`, opportunityId: `${PREFIX}ambiente`, opportunityTitle: "DEMO / Jornada de restauración ambiental", organizationId: JOAQUIN_UID, organizationName: "Comunidad Verde", userId: ana, authorName: "Ana Demo", rating: 5, comment: "DEMO / La actividad estuvo muy bien organizada y pude aprender sobre especies nativas.", status: "published", createdAt: new Date("2026-11-07T18:00:00-03:00") });
  add(`reviews/${PREFIX}resena-reportada`, { applicationId: `${PREFIX}resena-reportada`, opportunityId: `${PREFIX}educacion-virtual`, opportunityTitle: "DEMO / Apoyo escolar virtual", organizationId: JOAQUIN_UID, organizationName: "Comunidad Verde", userId: lucas, authorName: "Lucas Demo", rating: 3, comment: "DEMO / Reseña ficticia preparada para mostrar el proceso de denuncia.", status: "reported", createdAt: new Date("2026-11-07T17:00:00-03:00") });
  add(`reviewReports/${PREFIX}reporte`, { reviewId: `${PREFIX}resena-reportada`, reporterId: ana, reason: "DEMO / Solicitud de revisión académica del contenido.", status: "pending", createdAt: new Date("2026-11-08T10:00:00-03:00") });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="430"><rect width="760" height="430" fill="#173a33"/><circle cx="180" cy="210" r="90" fill="#77cbb8"/><path d="M310 300 Q450 90 620 260" fill="none" stroke="#d7f3ea" stroke-width="36"/><text x="380" y="390" fill="white" font-size="28" text-anchor="middle">DEMO / Foto académica</text></svg>`;
  add(`reviewPhotos/${PREFIX}foto-pendiente`, { reviewId: `${PREFIX}resena-publica`, userId: ana, imageDataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, status: "pending", createdAt: new Date("2026-11-08T11:00:00-03:00") });
  add(`feedback/${PREFIX}feedback-pendiente`, { matchId: `${PREFIX}feedback-pendiente`, opportunityId: `${PREFIX}ambiente`, opportunityTitle: "DEMO / Jornada de restauración ambiental", organizationId: JOAQUIN_UID, organizationName: "Comunidad Verde", submittedByEmail: JOAQUIN_EMAIL, volunteerId: suspended, volunteerName: "Usuario DEMO suspendido", tasks: ["Organización de materiales"], skills: [], assessment: "needs_improvement", details: "DEMO / Se registraron llegadas tarde reiteradas y falta de comunicación previa.", status: "pending_review", createdAt: new Date("2026-11-08T12:00:00-03:00") });
  add(`feedback/${PREFIX}feedback-historico`, { matchId: `${PREFIX}feedback-historico`, opportunityId: `${PREFIX}ambiente`, opportunityTitle: "DEMO / Experiencia anterior", organizationId: JOAQUIN_UID, organizationName: "Comunidad Verde", submittedByEmail: JOAQUIN_EMAIL, volunteerId: lucas, volunteerName: "Lucas Demo", tasks: ["Preparó materiales"], skills: ["Organización y logística"], assessment: "positive", details: "DEMO / Participación satisfactoria.", status: "recorded", createdAt: new Date("2026-10-20T12:00:00-03:00") });
  add(`absenceReports/${PREFIX}ausencia`, { matchId: `${PREFIX}ausencia`, opportunityId: `${PREFIX}educacion-virtual`, opportunityTitle: "DEMO / Apoyo escolar virtual", organizationId: JOAQUIN_UID, organizationName: "Comunidad Verde", volunteerId: lucas, volunteerName: "Lucas Demo", reportedBy: JOAQUIN_UID, reportedByEmail: JOAQUIN_EMAIL, reason: "DEMO / No se presentó y el aviso llegó con menos de seis horas de anticipación.", status: "pending_review", createdAt: new Date("2026-11-08T13:00:00-03:00") });
  add(`adminActions/${PREFIX}advertencia-historica`, { actorId: "demo-admin", actorEmail: "admin.demo@voluntariando.invalid", action: "approve_negative_feedback", targetType: "feedback", targetId: `${PREFIX}feedback-historico`, reason: "DEMO / Advertencia académica registrada", createdAt: new Date("2026-10-21T13:00:00-03:00") });
  add(`adminActions/${PREFIX}suspension-historica`, { actorId: "demo-admin", actorEmail: "admin.demo@voluntariando.invalid", action: "suspend_user", targetType: "user", targetId: suspended, reason: "DEMO / Suspensión académica temporal", createdAt: new Date("2026-11-02T13:00:00-03:00") });
  return docs;
}

async function inspect() {
  const user = await getDocument(`users/${JOAQUIN_UID}`);
  const profile = await getDocument(`volunteerProfiles/${JOAQUIN_UID}`);
  const organization = await getDocument(`organizations/${JOAQUIN_UID}`);
  if (!user || decode(user.fields?.email) !== JOAQUIN_EMAIL) throw new Error("La cuenta de Joaquín no coincide con el UID esperado.");
  if (!profile || !organization) throw new Error("Falta el perfil voluntario o la organización vinculada de Joaquín.");
  const applications = await listDocuments("applications");
  const preparedRequests = applications.filter(({ id, data }) => !id.startsWith(PREFIX) && data.organizationId === JOAQUIN_UID && data.status === "pending" && String(data.message ?? "").toLocaleLowerCase("es").includes("quiero participar"));
  return { user, profile, organization, preparedRequests };
}

async function ensureBackup(profile) {
  const path = `demoBackups/${PREFIX}joaquin`;
  if (await getDocument(path)) return;
  const keys = ["verifiedSkills", "experiences", "completedExperiences", "lastExperienceMatchId", "updatedAt"];
  const original = Object.fromEntries(keys.filter((key) => profile.fields?.[key]).map((key) => [key, profile.fields[key]]));
  await putDocument(path, { profileRawJson: JSON.stringify(original), fieldPaths: keys, createdAt: new Date() });
}

async function seed(state, docs) {
  if (confirmedProject !== PROJECT_ID) throw new Error(`Para cargar, agregá --confirm-project=${PROJECT_ID}`);
  await ensureBackup(state.profile);
  for (const [path, data] of docs) await putDocument(path, data);
  console.log(`Carga terminada: ${docs.size} documentos DEMO preparados. No se modificaron solicitudes reales existentes.`);
}

async function clean(docs) {
  if (confirmedProject !== PROJECT_ID) throw new Error(`Para limpiar, agregá --confirm-project=${PROJECT_ID}`);
  const backupPath = `demoBackups/${PREFIX}joaquin`;
  const backup = await getDocument(backupPath);
  if (backup) {
    const raw = JSON.parse(decode(backup.fields.profileRawJson));
    const fieldPaths = decode(backup.fields.fieldPaths);
    await patchRaw(`volunteerProfiles/${JOAQUIN_UID}`, raw, fieldPaths);
  }
  for (const path of [...docs.keys()].reverse()) await deleteDocument(path);
  await deleteDocument(backupPath);
  console.log(`Limpieza terminada: se retiraron únicamente documentos ${PREFIX} y se restauró la trayectoria previa de Joaquín.`);
}

const state = await inspect();
const docs = buildDemoDocuments(state.preparedRequests.length > 0);
const counts = [...docs.keys()].reduce((result, path) => {
  const collection = path.split("/")[0];
  result[collection] = (result[collection] ?? 0) + 1;
  return result;
}, {});

if (mode === "plan") {
  console.log(JSON.stringify({
    project: PROJECT_ID,
    joaquin: { uid: JOAQUIN_UID, email: JOAQUIN_EMAIL, organization: decode(state.organization.fields.name) },
    existingPreparedRequests: state.preparedRequests.map(({ id, data }) => ({ id, userName: data.userName, opportunityTitle: data.opportunityTitle, message: data.message })),
    documentsToPrepare: docs.size,
    byCollection: counts,
    safety: "Solo se usarán IDs demo-e4-. La trayectoria de Joaquín se respaldará antes de cualquier experiencia grabada.",
  }, null, 2));
} else if (mode === "seed") {
  await seed(state, docs);
} else {
  await clean(docs);
}
