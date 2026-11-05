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
      setDoc(doc(database, "users/admin"), {
        email: "admin@example.com",
        role: "admin",
        status: "active",
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
      setDoc(doc(database, "volunteerProfiles/vol"), {
        name: "Persona voluntaria",
        verifiedSkills: {},
        experiences: [],
        completedExperiences: 0,
      }),
      setDoc(doc(database, "invitations/inv"), {
        organizationId: "org",
        opportunityId: "opp",
        userId: "vol",
        status: "accepted",
      }),
      setDoc(doc(database, "matches/invitation_inv"), {
        organizationId: "org",
        opportunityId: "opp",
        userId: "vol",
        invitationId: "inv",
        source: "invitation",
        status: "confirmed",
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

test("un usuario ajeno no puede marcar como completada una invitación", async () => {
  const outsider = testEnvironment.authenticatedContext("other", {
    email: "otro@example.com",
  });
  const invitation = doc(outsider.firestore(), "invitations/inv");

  await assertFails(updateDoc(invitation, { completedAt: serverTimestamp() }));
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
