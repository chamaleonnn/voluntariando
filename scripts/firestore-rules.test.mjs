import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { calculateCompatibility } from "../lib/recommendations.ts";

const projectId = "voluntariando-rules-test";
let testEnvironment;

// Prepara una base aislada que usa exactamente las reglas del proyecto.
before(async () => {
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });

  // Estos documentos representan el estado previo a completar una experiencia.
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await Promise.all([
      setDoc(doc(database, "users/org"), {
        email: "organizacion@example.com",
        role: "organization",
        status: "active",
      }),
      setDoc(doc(database, "users/vol"), {
        email: "voluntario@example.com",
        role: "volunteer",
        status: "active",
      }),
      setDoc(doc(database, "users/other"), {
        email: "otro@example.com",
        role: "volunteer",
        status: "active",
      }),
      setDoc(doc(database, "users/progress-vol"), {
        email: "progreso@example.com", role: "volunteer", status: "active",
      }),
      setDoc(doc(database, "users/admin"), {
        email: "admin@example.com",
        role: "admin",
        status: "active",
      }),
      setDoc(doc(database, "users/expired"), {
        email: "expired@example.com",
        role: "volunteer",
        status: "suspended",
        suspensionReason: "Prueba temporal",
        suspendedUntil: new Date("2025-01-01T00:00:00.000Z"),
      }),
      setDoc(doc(database, "organizationMembers/org_org"), {
        organizationId: "org",
        userId: "org",
        role: "owner",
      }),
      setDoc(doc(database, "organizations/org"), {
        ownerId: "org",
        name: "Merendero de prueba",
        status: "verified",
      }),
      setDoc(doc(database, "organizations/pending-org"), {
        ownerId: "pending-org",
        name: "Organización pendiente",
        status: "pending",
      }),
      setDoc(doc(database, "organizationMembers/pending-org_pending-org"), {
        organizationId: "pending-org",
        userId: "pending-org",
        role: "owner",
      }),
      setDoc(doc(database, "users/pending-org"), {
        email: "pendiente@example.com",
        role: "organization",
        status: "active",
      }),
      setDoc(doc(database, "opportunities/opp"), {
        organizationId: "org",
        title: "Apoyo escolar",
        status: "published",
        visibility: "public",
      }),
      setDoc(doc(database, "opportunities/integration-huerta"), {
        organizationId: "org", title: "Huerta", category: "Ambiente",
        requiredSkills: ["Naturaleza y ambiente"], availability: ["Sábado por la mañana"],
        province: "Córdoba", neighborhood: "Córdoba capital", modality: "Presencial",
        status: "published", visibility: "public",
      }),
      setDoc(doc(database, "applications/accepted-app"), {
        opportunityId: "opp", organizationId: "org", userId: "vol",
        userEmail: "voluntario@example.com", status: "accepted",
      }),
      setDoc(doc(database, "volunteerProfiles/vol"), {
        name: "Persona voluntaria",
        verifiedSkills: {},
        experiences: [],
        completedExperiences: 0,
        visibleToOrganizations: true,
        visibleToVolunteers: true,
      }),
      setDoc(doc(database, "volunteerProfiles/private-vol"), {
        name: "Perfil privado", verifiedSkills: {}, experiences: [], completedExperiences: 0,
        visibleToOrganizations: false, visibleToVolunteers: false,
      }),
      setDoc(doc(database, "volunteerProfiles/progress-vol"), {
        name: "Persona en progreso", location: "Córdoba capital", interests: ["Ambiente"],
        declaredSkills: ["Cocina"], verifiedSkills: {}, availability: ["Sábado por la mañana"],
        experiences: [], completedExperiences: 0,
        visibleToOrganizations: true, visibleToVolunteers: true,
      }),
      setDoc(doc(database, "invitations/inv"), {
        organizationId: "org",
        opportunityId: "opp",
        userId: "vol",
        status: "accepted",
      }),
      setDoc(doc(database, "invitations/pending-inv"), {
        organizationId: "org", opportunityId: "opp", userId: "vol", status: "pending",
      }),
      setDoc(doc(database, "matches/invitation_inv"), {
        organizationId: "org",
        opportunityId: "opp",
        userId: "vol",
        invitationId: "inv",
        source: "invitation",
        status: "confirmed",
      }),
      setDoc(doc(database, "matches/absence_match"), {
        organizationId: "org", opportunityId: "opp", userId: "vol", status: "confirmed",
      }),
      setDoc(doc(database, "matches/integration-huerta_progress-vol"), {
        organizationId: "org", opportunityId: "integration-huerta", userId: "progress-vol",
        source: "application", status: "confirmed",
      }),
      setDoc(doc(database, "feedback/negative-review"), {
        matchId: "previous-match",
        opportunityId: "opp",
        organizationId: "org",
        volunteerId: "vol",
        assessment: "needs_improvement",
        details: "Necesita mejorar la puntualidad informada.",
        status: "pending_review",
      }),
    ]);
  });
});

// Cierra las conexiones para que la prueba termine sin procesos colgados.
after(async () => {
  await testEnvironment.cleanup();
});

test("la organización puede cerrar una experiencia invitada en una sola operación", async () => {
  const organization = testEnvironment.authenticatedContext("org", {
    email: "organizacion@example.com",
  });
  const database = organization.firestore();
  const batch = writeBatch(database);

  // El lote imita el flujo real: match, participación, devolución, perfil e invitación.
  batch.update(doc(database, "matches/invitation_inv"), {
    status: "completed",
    completedAt: serverTimestamp(),
  });
  batch.set(doc(database, "participations/invitation_inv"), {
    matchId: "invitation_inv",
    opportunityId: "opp",
    organizationId: "org",
    userId: "vol",
    status: "completed",
    completedAt: serverTimestamp(),
  });
  batch.set(doc(database, "feedback/invitation_inv"), {
    matchId: "invitation_inv",
    opportunityId: "opp",
    organizationId: "org",
    volunteerId: "vol",
    tasks: "Acompañó a niñas y niños con sus tareas.",
    skills: ["Comunicación"],
    assessment: "positive",
    details: "Participación satisfactoria.",
    status: "recorded",
    createdAt: serverTimestamp(),
  });
  batch.update(doc(database, "volunteerProfiles/vol"), {
    "verifiedSkills.Comunicación": increment(1),
    experiences: [{ matchId: "invitation_inv", opportunityId: "opp" }],
    completedExperiences: increment(1),
    lastExperienceMatchId: "invitation_inv",
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(database, "invitations/inv"), {
    completedAt: serverTimestamp(),
  });

  await assertSucceeds(batch.commit());

  // Además de autorizarse, el resultado debe quedar realmente persistido.
  const profile = await getDoc(doc(database, "volunteerProfiles/vol"));
  assert.equal(profile.data().verifiedSkills.Comunicación, 1);
  assert.equal(profile.data().completedExperiences, 1);
});

test("una experiencia persistida actualiza la compatibilidad de 55 a 90", async () => {
  const opportunity = {
    id: "integration-huerta", title: "Huerta", organization: "Comunidad", organizationId: "org",
    description: "", tasks: ["Preparar la huerta"], requirements: [], date: "2026-11-10",
    dateLabel: "10 nov", time: "10:00", neighborhood: "Córdoba capital", addressHint: "",
    latitude: 0, longitude: 0, distanceKm: 0, capacity: 10, availableSpots: 5,
    category: "Ambiente", province: "Córdoba", modality: "Presencial",
    availability: ["Sábado por la mañana"], requiredSkills: ["Naturaleza y ambiente"],
    imageUrl: "", visibility: "public", status: "published",
  };
  const organization = testEnvironment.authenticatedContext("org", { email: "organizacion@example.com" });
  const database = organization.firestore();
  const profileRef = doc(database, "volunteerProfiles/progress-vol");
  const initialProfile = { id: "progress-vol", ...(await getDoc(profileRef)).data() };
  assert.equal(calculateCompatibility(initialProfile, opportunity).score, 55);

  const experience = {
    opportunityId: "integration-huerta", opportunityTitle: "Huerta previa", organization: "Org",
    tasks: ["Preparar huerta"], skills: ["Naturaleza y ambiente"], completedAt: "2026-11-07T12:00:00.000Z",
  };
  const batch = writeBatch(database);
  batch.update(doc(database, "matches/integration-huerta_progress-vol"), { status: "completed", completedAt: serverTimestamp() });
  batch.set(doc(database, "participations/integration-huerta_progress-vol"), {
    matchId: "integration-huerta_progress-vol", opportunityId: "integration-huerta",
    organizationId: "org", userId: "progress-vol", status: "completed", completedAt: serverTimestamp(),
  });
  batch.set(doc(database, "feedback/integration-huerta_progress-vol"), {
    matchId: "integration-huerta_progress-vol", opportunityId: "integration-huerta",
    organizationId: "org", volunteerId: "progress-vol", assessment: "positive",
    details: "Participación satisfactoria.", status: "recorded",
  });
  batch.update(profileRef, {
    "verifiedSkills.Naturaleza y ambiente": increment(1), experiences: [experience],
    completedExperiences: increment(1), lastExperienceMatchId: "integration-huerta_progress-vol",
    updatedAt: serverTimestamp(),
  });
  await assertSucceeds(batch.commit());

  const updatedProfile = { id: "progress-vol", ...(await getDoc(profileRef)).data() };
  const result = calculateCompatibility(updatedProfile, opportunity);
  assert.deepEqual(result.breakdown, { skills: 65, interests: 100, availability: 100, location: 100, experience: 100 });
  assert.equal(result.score, 90);
});

test("un usuario ajeno no puede marcar como completada una invitación", async () => {
  const outsider = testEnvironment.authenticatedContext("other", {
    email: "otro@example.com",
  });
  const invitation = doc(outsider.firestore(), "invitations/inv");

  await assertFails(updateDoc(invitation, { completedAt: serverTimestamp() }));
});

test("un tercero no puede leer una participación ajena", async () => {
  const outsider = testEnvironment.authenticatedContext("other", {
    email: "otro@example.com",
  });
  const participation = doc(outsider.firestore(), "participations/invitation_inv");

  await assertFails(getDoc(participation));
});

test("un tercero no puede modificar una participación ajena", async () => {
  const outsider = testEnvironment.authenticatedContext("other", {
    email: "otro@example.com",
  });
  const participation = doc(outsider.firestore(), "participations/invitation_inv");

  await assertFails(updateDoc(participation, { status: "cancelled" }));
});

test("el voluntario no puede acreditarse habilidades por su cuenta", async () => {
  const volunteer = testEnvironment.authenticatedContext("vol", {
    email: "voluntario@example.com",
  });
  const profile = doc(volunteer.firestore(), "volunteerProfiles/vol");

  await assertFails(updateDoc(profile, {
    "verifiedSkills.Liderazgo": 99,
    updatedAt: serverTimestamp(),
  }));
});

test("una organización pendiente no puede publicar hasta ser validada", async () => {
  const organization = testEnvironment.authenticatedContext("pending-org", {
    email: "pendiente@example.com",
  });
  const opportunity = doc(organization.firestore(), "opportunities/pending-opp");

  await assertFails(setDoc(opportunity, {
    organizationId: "pending-org",
    title: "Actividad todavía no validada",
    status: "published",
    visibility: "public",
  }));
});

test("un usuario no puede apropiarse de una organización ajena", async () => {
  const outsider = testEnvironment.authenticatedContext("other", { email: "otro@example.com" });
  await assertFails(setDoc(doc(outsider.firestore(), "organizationMembers/org_other"), {
    organizationId: "org", userId: "other", role: "owner", createdAt: serverTimestamp(),
  }));
});

test("una postulación no puede falsificar organización ni correo", async () => {
  const volunteer = testEnvironment.authenticatedContext("vol", { email: "voluntario@example.com", name: "Persona voluntaria" });
  await assertFails(setDoc(doc(volunteer.firestore(), "applications/opp_vol"), {
    opportunityId: "opp", opportunityTitle: "Apoyo escolar", organizationId: "other",
    userId: "vol", userName: "Persona voluntaria", userEmail: "falso@example.com",
    message: "Me interesa", status: "pending", createdAt: serverTimestamp(),
  }));
});

test("una postulación válida queda asociada a la oportunidad y al usuario autenticado", async () => {
  const volunteer = testEnvironment.authenticatedContext("vol", { email: "voluntario@example.com", name: "Persona voluntaria" });
  await assertSucceeds(setDoc(doc(volunteer.firestore(), "applications/opp_vol"), {
    opportunityId: "opp", opportunityTitle: "Apoyo escolar", organizationId: "org",
    userId: "vol", userName: "Persona voluntaria", userEmail: "voluntario@example.com",
    message: "Me interesa", status: "pending", createdAt: serverTimestamp(),
  }));
});

test("la aceptación válida crea un match consistente y bloquea regresiones de estado", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "applications/opp_vol"), {
      opportunityId: "opp", opportunityTitle: "Apoyo escolar", organizationId: "org",
      userId: "vol", userName: "Persona voluntaria", userEmail: "voluntario@example.com",
      status: "pending",
    });
  });
  const organization = testEnvironment.authenticatedContext("org", { email: "organizacion@example.com" });
  const database = organization.firestore();
  const batch = writeBatch(database);
  batch.update(doc(database, "applications/opp_vol"), { status: "accepted", updatedAt: serverTimestamp() });
  batch.set(doc(database, "matches/opp_vol"), {
    opportunityId: "opp", opportunityTitle: "Apoyo escolar", organizationId: "org",
    userId: "vol", source: "application", status: "confirmed", createdAt: serverTimestamp(),
  });
  await assertSucceeds(batch.commit());
  await assertFails(updateDoc(doc(database, "applications/opp_vol"), { status: "pending", updatedAt: serverTimestamp() }));
});

test("una organización no puede crear un match sin postulación aceptada", async () => {
  const organization = testEnvironment.authenticatedContext("org", { email: "organizacion@example.com" });
  await assertFails(setDoc(doc(organization.firestore(), "matches/opp_other"), {
    opportunityId: "opp", opportunityTitle: "Apoyo escolar", organizationId: "org",
    userId: "other", source: "application", status: "confirmed", createdAt: serverTimestamp(),
  }));
});

test("aceptar una invitación crea una única vinculación consistente", async () => {
  const volunteer = testEnvironment.authenticatedContext("vol", { email: "voluntario@example.com" });
  const database = volunteer.firestore();
  const batch = writeBatch(database);
  batch.update(doc(database, "invitations/pending-inv"), { status: "accepted", respondedAt: serverTimestamp() });
  batch.set(doc(database, "matches/invitation_pending-inv"), {
    invitationId: "pending-inv", opportunityId: "opp", organizationId: "org",
    userId: "vol", source: "invitation", status: "confirmed", createdAt: serverTimestamp(),
  });
  await assertSucceeds(batch.commit());

  const duplicate = writeBatch(database);
  duplicate.update(doc(database, "invitations/pending-inv"), { status: "accepted", respondedAt: serverTimestamp() });
  duplicate.set(doc(database, "matches/invitation_pending-inv"), {
    invitationId: "pending-inv", opportunityId: "opp", organizationId: "org",
    userId: "vol", source: "invitation", status: "confirmed", createdAt: serverTimestamp(),
  });
  await assertFails(duplicate.commit());
});

test("administración puede validar una organización pendiente", async () => {
  const admin = testEnvironment.authenticatedContext("admin", {
    email: "admin@example.com",
  });
  const organization = doc(admin.firestore(), "organizations/pending-org");

  await assertSucceeds(updateDoc(organization, {
    status: "verified",
    moderationReason: "Datos revisados",
    moderatedBy: "admin",
    moderatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
});

test("solo administración puede confirmar una devolución negativa y advertir en privado", async () => {
  const admin = testEnvironment.authenticatedContext("admin", { email: "admin@example.com" });
  const database = admin.firestore();
  const batch = writeBatch(database);
  batch.update(doc(database, "feedback/negative-review"), {
    status: "approved",
    moderationReason: "Corroborado con ambas partes",
    moderatedBy: "admin",
    moderatedAt: serverTimestamp(),
  });
  batch.set(doc(database, "notifications/feedback_warning_negative-review"), {
    recipientId: "vol",
    actorId: "admin",
    feedbackId: "negative-review",
    type: "feedback_warning",
    title: "Orientación para tu próxima experiencia",
    message: "Revisá los aspectos informados antes de participar nuevamente.",
    read: false,
    createdAt: serverTimestamp(),
  });

  await assertSucceeds(batch.commit());

  const outsider = testEnvironment.authenticatedContext("other", { email: "otro@example.com" });
  await assertFails(updateDoc(doc(outsider.firestore(), "feedback/negative-review"), { status: "dismissed" }));
});

test("una cuenta solo puede reactivarse a sí misma cuando la suspensión ya venció", async () => {
  const expired = testEnvironment.authenticatedContext("expired", { email: "expired@example.com" });
  await assertSucceeds(updateDoc(doc(expired.firestore(), "users/expired"), {
    status: "active",
    suspensionReason: null,
    suspendedUntil: null,
    lastLoginAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));

  const active = testEnvironment.authenticatedContext("other", { email: "otro@example.com" });
  await assertFails(updateDoc(doc(active.firestore(), "users/other"), {
    status: "suspended",
    suspensionReason: "Autoimpuesta",
    suspendedUntil: new Date("2030-01-01T00:00:00.000Z"),
    updatedAt: serverTimestamp(),
  }));
});

test("una ausencia requiere organización vinculada y confirmación administrativa", async () => {
  const organization = testEnvironment.authenticatedContext("org", { email: "organizacion@example.com" });
  const database = organization.firestore();
  const reportBatch = writeBatch(database);
  reportBatch.update(doc(database, "matches/absence_match"), { status: "absence_pending_review" });
  reportBatch.set(doc(database, "participations/absence_match"), { matchId: "absence_match", opportunityId: "opp", organizationId: "org", userId: "vol", status: "absence_pending_review", reportedBy: "org" });
  reportBatch.set(doc(database, "absenceReports/absence_match"), { matchId: "absence_match", opportunityId: "opp", organizationId: "org", volunteerId: "vol", reportedBy: "org", reason: "No asistió a la actividad acordada", status: "pending_review" });
  reportBatch.set(doc(database, "notifications/absence_reported_absence_match"), { recipientId: "vol", actorId: "org", absenceReportId: "absence_match", type: "absence_reported", title: "Ausencia informada", message: "Pendiente de revisión", read: false });
  await assertSucceeds(reportBatch.commit());

  const outsider = testEnvironment.authenticatedContext("other", { email: "otro@example.com" });
  await assertFails(getDoc(doc(outsider.firestore(), "absenceReports/absence_match")));

  const admin = testEnvironment.authenticatedContext("admin", { email: "admin@example.com" });
  const adminDb = admin.firestore();
  const reviewBatch = writeBatch(adminDb);
  reviewBatch.update(doc(adminDb, "absenceReports/absence_match"), { status: "confirmed", reviewedAt: serverTimestamp(), reviewedBy: "admin", reviewReason: "Corroborada" });
  reviewBatch.update(doc(adminDb, "participations/absence_match"), { status: "absent", reviewedAt: serverTimestamp(), reviewedBy: "admin" });
  reviewBatch.update(doc(adminDb, "matches/absence_match"), { status: "absent", reviewedAt: serverTimestamp(), reviewedBy: "admin" });
  reviewBatch.set(doc(adminDb, "notifications/absence_resolved_absence_match"), { recipientId: "vol", actorId: "admin", absenceReportId: "absence_match", type: "absence_resolved", title: "Ausencia confirmada", message: "1 de 3", read: false });
  await assertSucceeds(reviewBatch.commit());
});

test("la visibilidad del perfil se respeta para organizaciones y voluntarios", async () => {
  const organization = testEnvironment.authenticatedContext("org", { email: "organizacion@example.com" });
  await assertSucceeds(getDoc(doc(organization.firestore(), "volunteerProfiles/vol")));
  await assertFails(getDoc(doc(organization.firestore(), "volunteerProfiles/private-vol")));

  const volunteer = testEnvironment.authenticatedContext("other", { email: "otro@example.com" });
  await assertSucceeds(getDoc(doc(volunteer.firestore(), "volunteerProfiles/vol")));
  await assertFails(getDoc(doc(volunteer.firestore(), "volunteerProfiles/private-vol")));
});
