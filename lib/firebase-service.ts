import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import type { Application, Opportunity, Organization, SessionUser, VolunteerProfile } from "@/lib/types";

function requireDb() {
  if (!db) throw new Error("Firebase todavía no está configurado.");
  return db;
}

function asIsoDate(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return typeof value === "string" ? value : new Date().toISOString();
}

// Convierte un documento de Firestore al tipo que consume la interfaz.
function mapDoc<T extends { id: string }>(snapshot: { id: string; data: () => Record<string, unknown> }): T {
  const data = snapshot.data();
  return { ...data, id: snapshot.id, createdAt: asIsoDate(data.createdAt) } as unknown as T;
}

// Crea, en el primer ingreso, los datos mínimos del rol elegido.
async function toSessionUser(user: User, requestedRole: SessionUser["role"] = "volunteer"): Promise<SessionUser> {
  const firestore = requireDb();
  const userRef = doc(firestore, "users", user.uid);
  const snapshot = await getDoc(userRef);
  const stored = snapshot.data();
  const role: SessionUser["role"] = stored?.role === "organization" || stored?.role === "volunteer"
    ? stored.role
    : requestedRole;
  const email = user.email ?? "";
  const batch = writeBatch(firestore);

  if (!snapshot.exists()) {
    batch.set(userRef, {
      displayName: user.displayName ?? "Usuario",
      email,
      role,
      status: "active",
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });

    if (role === "volunteer") {
      batch.set(doc(firestore, "volunteerProfiles", user.uid), {
        name: user.displayName ?? "Voluntario",
        initials: (user.displayName ?? "V").split(" ").map((part) => part[0]).join("").slice(0, 2),
        location: "Córdoba",
        bio: "",
        completedExperiences: 0,
        verifiedHours: 0,
        interests: [],
        declaredSkills: [],
        verifiedSkills: {},
        availability: [],
        experiences: [],
        visibleToOrganizations: true,
        visibleToVolunteers: true,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(doc(firestore, "organizations", user.uid), {
        ownerId: user.uid,
        name: user.displayName ?? "Organización",
        email,
        province: "Córdoba",
        location: "Córdoba",
        contact: email,
        description: "",
        status: "verified",
        createdAt: serverTimestamp(),
      });
      batch.set(doc(firestore, "organizationMembers", `${user.uid}_${user.uid}`), {
        organizationId: user.uid,
        userId: user.uid,
        role: "owner",
        createdAt: serverTimestamp(),
      });
    }
  } else {
    batch.update(userRef, { lastLoginAt: serverTimestamp() });
  }

  await batch.commit();
  return {
    uid: user.uid,
    email,
    displayName: user.displayName ?? email.split("@")[0] ?? "Usuario",
    role,
    status: "active",
  };
}

export function observeAuth(callback: (user: SessionUser | null) => void) {
  if (!auth || !db) return () => undefined;
  void getRedirectResult(auth).catch((error) => console.error("No se pudo completar el ingreso con Google", error));
  return onAuthStateChanged(auth, async (user) => {
    if (!user) return callback(null);
    try {
      const requested = window.localStorage.getItem("red-cercana-requested-role");
      window.localStorage.removeItem("red-cercana-requested-role");
      callback(await toSessionUser(user, requested === "organization" ? "organization" : "volunteer"));
    } catch (error) {
      console.error("No se pudo cargar el perfil autenticado", error);
      callback(null);
    }
  });
}

export async function firebaseSignInWithGoogle(role: SessionUser["role"] = "volunteer") {
  if (!auth) throw new Error("Firebase todavía no está configurado.");
  window.localStorage.setItem("red-cercana-requested-role", role);
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  window.localStorage.removeItem("red-cercana-requested-role");
  return toSessionUser(result.user, role);
}

export async function firebaseSignOut() {
  if (auth) await signOut(auth);
}

export function observeOpportunities(callback: (items: Opportunity[]) => void, onError: (error: Error) => void) {
  if (!db) return () => undefined;
  const source = query(
    collection(db, "opportunities"),
    where("status", "==", "published"),
    where("visibility", "==", "public"),
    orderBy("date", "asc"),
  );
  return onSnapshot(source, (snapshot) => callback(snapshot.docs.map((item) => mapDoc<Opportunity>(item))), onError);
}

export function observeApplications(user: SessionUser, callback: (items: Application[]) => void, onError: (error: Error) => void) {
  if (!db || user.isDemo) return () => undefined;
  const field = user.role === "volunteer" ? "userId" : "organizationId";
  const source = query(collection(db, "applications"), where(field, "==", user.uid), orderBy("createdAt", "desc"));
  return onSnapshot(source, (snapshot) => callback(snapshot.docs.map((item) => mapDoc<Application>(item))), onError);
}

export function observeVolunteerProfile(userId: string, callback: (profile: VolunteerProfile | null) => void) {
  if (!db) return () => undefined;
  return onSnapshot(doc(db, "volunteerProfiles", userId), (snapshot) => {
    callback(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as VolunteerProfile) : null);
  });
}

export function observeOrganizations(callback: (items: Organization[]) => void, onError: (error: Error) => void) {
  if (!db) return () => undefined;
  const source = query(collection(db, "organizations"), where("status", "==", "verified"));
  return onSnapshot(source, (snapshot) => callback(snapshot.docs.map((item) => mapDoc<Organization>(item))), onError);
}

export async function createApplication(opportunity: Opportunity, user: SessionUser, message = "Me interesa participar.") {
  const firestore = requireDb();
  const id = `${opportunity.id}_${user.uid}`;
  await setDoc(doc(firestore, "applications", id), {
    id,
    opportunityId: opportunity.id,
    opportunityTitle: opportunity.title,
    organizationId: opportunity.organizationId,
    userId: user.uid,
    userName: user.displayName,
    userEmail: user.email,
    message,
    status: "pending",
    createdAt: serverTimestamp(),
  });
  return id;
}

export async function createOpportunity(opportunity: Omit<Opportunity, "id">) {
  const firestore = requireDb();
  const created = await addDoc(collection(firestore, "opportunities"), {
    ...opportunity,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { ...opportunity, id: created.id };
}

export async function updateApplicationStatus(application: Application, status: Application["status"]) {
  const firestore = requireDb();
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, "applications", application.id), { status, updatedAt: serverTimestamp() });
  if (status === "accepted") {
    batch.set(doc(firestore, "matches", `${application.opportunityId}_${application.userId}`), {
      opportunityId: application.opportunityId,
      opportunityTitle: application.opportunityTitle,
      organizationId: application.organizationId,
      userId: application.userId,
      source: "application",
      status: "confirmed",
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function saveVolunteerProfile(profile: VolunteerProfile) {
  const firestore = requireDb();
  const { id, ...data } = profile;
  await setDoc(doc(firestore, "volunteerProfiles", id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export async function saveOrganizationProfile(organization: Organization) {
  const firestore = requireDb();
  const { id, ...data } = organization;
  await setDoc(doc(firestore, "organizations", id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export async function updateOpportunity(opportunity: Opportunity) {
  const firestore = requireDb();
  const { id, ...data } = opportunity;
  await updateDoc(doc(firestore, "opportunities", id), { ...data, updatedAt: serverTimestamp() });
}

// Registra el cierre de la experiencia y actualiza la trayectoria en una transacción.
export async function recordCompletedExperience(
  application: Application,
  values: { tasks: string[]; skills: string[]; organizationName: string },
) {
  const firestore = requireDb();
  const matchId = `${application.opportunityId}_${application.userId}`;
  await runTransaction(firestore, async (transaction) => {
    const participationRef = doc(firestore, "participations", matchId);
    if ((await transaction.get(participationRef)).exists()) throw new Error("Esta participación ya fue registrada.");

    const profileRef = doc(firestore, "volunteerProfiles", application.userId);
    const profile = (await transaction.get(profileRef)).data() as VolunteerProfile | undefined;
    const verifiedSkills = { ...(profile?.verifiedSkills ?? {}) };
    values.skills.forEach((skill) => { verifiedSkills[skill] = (verifiedSkills[skill] ?? 0) + 1; });
    const experience = {
      opportunityId: application.opportunityId,
      opportunityTitle: application.opportunityTitle,
      organization: values.organizationName,
      tasks: values.tasks,
      skills: values.skills,
      completedAt: new Date().toISOString(),
    };

    transaction.set(participationRef, {
      matchId,
      opportunityId: application.opportunityId,
      organizationId: application.organizationId,
      userId: application.userId,
      status: "completed",
      completedAt: serverTimestamp(),
    });
    transaction.set(doc(firestore, "feedback", matchId), {
      matchId,
      opportunityId: application.opportunityId,
      organizationId: application.organizationId,
      volunteerId: application.userId,
      tasks: values.tasks,
      skills: values.skills,
      status: "recorded",
      createdAt: serverTimestamp(),
    });
    transaction.update(doc(firestore, "matches", matchId), { status: "completed", completedAt: serverTimestamp() });
    transaction.update(doc(firestore, "applications", application.id), { completedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    transaction.set(profileRef, {
      verifiedSkills,
      experiences: [...(profile?.experiences ?? []), experience],
      completedExperiences: (profile?.completedExperiences ?? 0) + 1,
      lastExperienceMatchId: matchId,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
}
