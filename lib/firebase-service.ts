import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
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
import type { AppNotification, Application, Opportunity, OpportunityStatus, Organization, PlatformUser, Review, ReviewPhoto, ReviewReport, SessionUser, VolunteerProfile } from "@/lib/types";

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
  const email = user.email ?? "";
  const bootstrapAdmin = requestedRole === "admin" && email === "leybatao014@gmail.com";
  const storedRole = stored?.role === "organization" || stored?.role === "volunteer" || stored?.role === "admin"
    ? stored.role
    : null;
  if (requestedRole === "admin" && !bootstrapAdmin && storedRole !== "admin") {
    throw new Error("Esta cuenta no tiene permisos de administración.");
  }
  const role: SessionUser["role"] = bootstrapAdmin
    ? "admin"
    : storedRole ?? requestedRole;
  const batch = writeBatch(firestore);

  if (stored?.status === "suspended") {
    const until = stored.suspendedUntil instanceof Timestamp ? stored.suspendedUntil.toDate() : null;
    const detail = until ? ` hasta el ${until.toLocaleDateString("es-AR")}` : "";
    throw new Error(`La cuenta está suspendida${detail}. ${stored.suspensionReason ?? "Contactá a administración."}`);
  }

  if (!snapshot.exists()) {
    batch.set(userRef, {
      displayName: user.displayName ?? "Usuario",
      email,
      role,
      status: "active",
      // Constancia mínima del consentimiento mostrado antes de abrir Google.
      privacyConsentVersion: "tesis-2026-11-04",
      privacyConsentAcceptedAt: serverTimestamp(),
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
        featuredMedals: [],
        availability: [],
        socialLinks: {},
        experiences: [],
        visibleToOrganizations: true,
        visibleToVolunteers: true,
        updatedAt: serverTimestamp(),
      });
    } else if (role === "organization") {
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
    batch.update(userRef, { lastLoginAt: serverTimestamp(), ...(bootstrapAdmin ? { role: "admin" } : {}) });
  }

  await batch.commit();
  return {
    uid: user.uid,
    email,
    displayName: user.displayName ?? email.split("@")[0] ?? "Usuario",
    role,
    status: stored?.status === "suspended" ? "suspended" : "active",
  };
}

export function observeAuth(callback: (user: SessionUser | null) => void) {
  if (!auth || !db) return () => undefined;
  const firebaseAuth = auth;
  void getRedirectResult(firebaseAuth).catch((error) => {
    window.localStorage.setItem("voluntariando-auth-error", authErrorMessage(error));
    window.localStorage.removeItem("voluntariando-requested-role");
    console.error("No se pudo completar el ingreso con Google", error);
  });
  return onAuthStateChanged(firebaseAuth, async (user) => {
    if (!user) return callback(null);
    try {
      const requested = window.localStorage.getItem("voluntariando-requested-role");
      window.localStorage.removeItem("voluntariando-requested-role");
      const role = requested === "organization" || requested === "admin" ? requested : "volunteer";
      callback(await toSessionUser(user, role));
    } catch (error) {
      console.error("No se pudo cargar el perfil autenticado", error);
      window.localStorage.setItem("voluntariando-auth-error", authErrorMessage(error));
      await signOut(firebaseAuth);
      callback(null);
    }
  });
}

function needsRedirect() {
  const agent = window.navigator.userAgent;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(agent);
  const embedded = /Instagram|FBAN|FBAV|Line|WhatsApp/i.test(agent);
  return mobile || embedded;
}

export function authErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code.includes("popup-blocked")) return "El navegador bloqueó la ventana de Google. Abrí el enlace en Chrome o Safari e intentá nuevamente.";
  if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request")) return "El acceso con Google se cerró antes de finalizar.";
  if (code.includes("unauthorized-domain")) return "Este dominio todavía no está autorizado para iniciar sesión con Google.";
  if (code.includes("network-request-failed")) return "No pudimos conectarnos con Google. Revisá tu conexión e intentá nuevamente.";
  if (code.includes("web-storage-unsupported") || code.includes("operation-not-supported")) return "Este navegador no permite completar el acceso. Abrí el enlace en Chrome o Safari.";
  if (error instanceof Error && error.message) return error.message;
  return "No pudimos iniciar sesión. Intentá nuevamente desde Chrome o Safari.";
}

export async function firebaseSignInWithGoogle(role: SessionUser["role"] = "volunteer") {
  if (!auth) throw new Error("Firebase todavía no está configurado.");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  window.localStorage.setItem("voluntariando-requested-role", role);

  if (needsRedirect()) {
    await signInWithRedirect(auth, provider);
  }

  try {
    const result = await signInWithPopup(auth, provider);
    window.localStorage.removeItem("voluntariando-requested-role");
    return await toSessionUser(result.user, role);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code.includes("popup-blocked") || code.includes("operation-not-supported-in-this-environment")) {
      await signInWithRedirect(auth, provider);
    }
    window.localStorage.removeItem("voluntariando-requested-role");
    if (auth.currentUser) await signOut(auth);
    throw new Error(authErrorMessage(error));
  }
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

export function observeNotifications(userId: string, callback: (items: AppNotification[]) => void, onError: (error: Error) => void) {
  if (!db) return () => undefined;
  const source = query(collection(db, "notifications"), where("recipientId", "==", userId));
  return onSnapshot(source, (snapshot) => {
    const items = snapshot.docs.map((item) => mapDoc<AppNotification>(item));
    callback(items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, onError);
}

export async function markNotificationRead(notificationId: string) {
  const firestore = requireDb();
  await updateDoc(doc(firestore, "notifications", notificationId), { read: true, readAt: serverTimestamp() });
}

export function observeVolunteerProfile(userId: string, callback: (profile: VolunteerProfile | null) => void) {
  if (!db) return () => undefined;
  return onSnapshot(doc(db, "volunteerProfiles", userId), (snapshot) => {
    callback(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as VolunteerProfile) : null);
  });
}

// Observa el perfil propio de una organización, incluso mientras todavía está incompleto.
export function observeOrganizationProfile(organizationId: string, callback: (organization: Organization | null) => void) {
  if (!db) return () => undefined;
  return onSnapshot(doc(db, "organizations", organizationId), (snapshot) => {
    callback(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Organization) : null);
  });
}

export function observeOrganizations(callback: (items: Organization[]) => void, onError: (error: Error) => void) {
  if (!db) return () => undefined;
  const source = query(collection(db, "organizations"), where("status", "==", "verified"));
  return onSnapshot(source, (snapshot) => callback(snapshot.docs.map((item) => mapDoc<Organization>(item))), onError);
}

export function observeReviews(callback: (items: Review[]) => void, onError: (error: Error) => void) {
  if (!db) return () => undefined;
  const source = query(collection(db, "reviews"), where("status", "==", "published"));
  return onSnapshot(source, (snapshot) => {
    const items = snapshot.docs.map((item) => mapDoc<Review>(item));
    callback(items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, onError);
}

// Reduce la foto antes de guardarla para respetar el límite de Firestore y ahorrar datos móviles.
async function compressReviewPhoto(file: File) {
  const source = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("No pudimos leer la imagen seleccionada."));
      element.src = source;
    });
    const scale = Math.min(1, 960 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.68);
    if (imageDataUrl.length > 750_000) throw new Error("La imagen sigue siendo demasiado pesada. Elegí una foto más pequeña.");
    return imageDataUrl;
  } finally {
    URL.revokeObjectURL(source);
  }
}

export async function createReview(review: Omit<Review, "id" | "createdAt" | "status">, photo?: File) {
  const firestore = requireDb();
  const reviewRef = doc(firestore, "reviews", review.applicationId);
  const batch = writeBatch(firestore);
  batch.set(reviewRef, { ...review, status: "published", createdAt: serverTimestamp() });

  // La imagen reducida queda en un documento privado hasta que administración la aprueba.
  if (photo) {
    const imageDataUrl = await compressReviewPhoto(photo);
    batch.set(doc(firestore, "reviewPhotos", review.applicationId), {
      reviewId: review.applicationId, userId: review.userId, imageDataUrl,
      status: "pending", createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return { ...review, id: reviewRef.id, status: "published" as const, createdAt: new Date().toISOString() };
}

// El público solo recibe fotos que ya fueron aprobadas.
export function observeApprovedReviewPhotos(callback: (items: ReviewPhoto[]) => void, onError: (error: Error) => void) {
  if (!db) return () => undefined;
  const source = query(collection(db, "reviewPhotos"), where("status", "==", "approved"));
  return onSnapshot(source, (snapshot) => callback(snapshot.docs.map((item) => mapDoc<ReviewPhoto>(item))), onError);
}

export async function reportReview(reviewId: string, reporterId: string, reason: string) {
  const firestore = requireDb();
  const reportRef = doc(firestore, "reviewReports", `${reviewId}_${reporterId}`);
  await setDoc(reportRef, { reviewId, reporterId, reason, status: "pending", createdAt: serverTimestamp() });
}

export function observeAdminReviews(callback: (items: Review[]) => void, onError: (error: Error) => void) {
  if (!db) return () => undefined;
  return onSnapshot(collection(db, "reviews"), (snapshot) => callback(snapshot.docs.map((item) => mapDoc<Review>(item))), onError);
}

export function observeAdminReviewReports(callback: (items: ReviewReport[]) => void, onError: (error: Error) => void) {
  if (!db) return () => undefined;
  return onSnapshot(collection(db, "reviewReports"), (snapshot) => callback(snapshot.docs.map((item) => mapDoc<ReviewReport>(item))), onError);
}

export function observeAdminReviewPhotos(callback: (items: ReviewPhoto[]) => void, onError: (error: Error) => void) {
  if (!db) return () => undefined;
  return onSnapshot(collection(db, "reviewPhotos"), (snapshot) => callback(snapshot.docs.map((item) => mapDoc<ReviewPhoto>(item))), onError);
}

export async function adminModerateReviewPhoto(actor: SessionUser, photo: ReviewPhoto, status: "approved" | "rejected", reason: string) {
  const firestore = requireDb();
  const batch = writeBatch(firestore);
  const moderatedAt = new Date().toISOString();
  batch.update(doc(firestore, "reviewPhotos", photo.id), { status, moderationReason: reason, moderatedBy: actor.uid, moderatedAt: serverTimestamp() });
  batch.set(doc(collection(firestore, "adminActions")), { actorId: actor.uid, action: status === "approved" ? "approve_review_photo" : "reject_review_photo", targetType: "reviewPhoto", targetId: photo.id, reason, createdAt: serverTimestamp() });
  await batch.commit();
  return { ...photo, status, moderationReason: reason, moderatedBy: actor.uid, moderatedAt };
}

export async function adminModerateReview(actor: SessionUser, review: Review, report: ReviewReport, status: "published" | "hidden", reason: string) {
  const firestore = requireDb();
  const batch = writeBatch(firestore);
  const moderatedAt = new Date().toISOString();
  batch.update(doc(firestore, "reviews", review.id), { status, moderationReason: reason, moderatedBy: actor.uid, moderatedAt: serverTimestamp() });
  batch.update(doc(firestore, "reviewReports", report.id), { status: "resolved", resolvedBy: actor.uid, resolvedAt: serverTimestamp() });
  batch.set(doc(collection(firestore, "adminActions")), { actorId: actor.uid, action: status === "hidden" ? "hide_review" : "keep_review", targetType: "review", targetId: review.id, reason, createdAt: serverTimestamp() });
  await batch.commit();
  return { ...review, status, moderationReason: reason, moderatedBy: actor.uid, moderatedAt };
}

// El panel administrativo necesita el listado completo de cuentas, incluidos sus correos y estados.
export function observeAdminUsers(callback: (items: PlatformUser[]) => void, onError: (error: Error) => void) {
  if (!db) return () => undefined;
  return onSnapshot(collection(db, "users"), (snapshot) => {
    const items = snapshot.docs.map((item) => {
      const data = item.data();
      return {
        uid: item.id,
        email: String(data.email ?? ""),
        displayName: String(data.displayName ?? data.email ?? "Usuario"),
        role: data.role as PlatformUser["role"],
        status: data.status === "suspended" ? "suspended" : "active",
        createdAt: asIsoDate(data.createdAt),
        suspendedUntil: data.suspendedUntil instanceof Timestamp ? data.suspendedUntil.toDate().toISOString() : undefined,
        suspensionReason: typeof data.suspensionReason === "string" ? data.suspensionReason : undefined,
      } satisfies PlatformUser;
    });
    callback(items.sort((a, b) => a.displayName.localeCompare(b.displayName, "es")));
  }, onError);
}

// A diferencia del catálogo público, administración también ve publicaciones cerradas.
export function observeAdminOpportunities(callback: (items: Opportunity[]) => void, onError: (error: Error) => void) {
  if (!db) return () => undefined;
  return onSnapshot(collection(db, "opportunities"), (snapshot) => {
    callback(snapshot.docs.map((item) => mapDoc<Opportunity>(item)));
  }, onError);
}

// Administración puede auditar todas las solicitudes, independientemente de la organización.
export function observeAdminApplications(callback: (items: Application[]) => void, onError: (error: Error) => void) {
  if (!db) return () => undefined;
  return onSnapshot(collection(db, "applications"), (snapshot) => {
    callback(snapshot.docs.map((item) => mapDoc<Application>(item)));
  }, onError);
}

// Modifica una cuenta y registra quién hizo el cambio, cuándo y por qué.
export async function adminUpdateUser(
  actor: SessionUser,
  target: PlatformUser,
  values: { displayName: string; role: SessionUser["role"]; status: "active" | "suspended"; suspensionDays: number; reason: string },
) {
  const firestore = requireDb();
  const batch = writeBatch(firestore);
  const suspendedUntil = values.status === "suspended"
    ? new Date(Date.now() + Math.max(1, values.suspensionDays) * 24 * 60 * 60 * 1000)
    : null;
  batch.update(doc(firestore, "users", target.uid), {
    displayName: values.displayName,
    role: values.role,
    status: values.status,
    suspensionReason: values.status === "suspended" ? values.reason : null,
    suspendedUntil,
    moderatedBy: actor.uid,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(collection(firestore, "adminActions")), {
    actorId: actor.uid,
    actorEmail: actor.email,
    action: values.status === "suspended" ? "suspend_user" : "update_or_restore_user",
    targetType: "user",
    targetId: target.uid,
    reason: values.reason,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return { ...target, displayName: values.displayName, role: values.role, status: values.status, suspendedUntil: suspendedUntil?.toISOString(), suspensionReason: values.status === "suspended" ? values.reason : undefined };
}

// Corrige el contenido o cambia la visibilidad de una oportunidad sin destruir información.
export async function adminUpdateOpportunity(
  actor: SessionUser,
  target: Opportunity,
  values: { title: string; description: string; status: OpportunityStatus; reason: string },
) {
  const firestore = requireDb();
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, "opportunities", target.id), {
    title: values.title,
    description: values.description,
    status: values.status,
    moderationReason: values.reason,
    moderatedBy: actor.uid,
    moderatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(collection(firestore, "adminActions")), {
    actorId: actor.uid,
    actorEmail: actor.email,
    action: values.status === "closed" ? "hide_opportunity" : "update_or_restore_opportunity",
    targetType: "opportunity",
    targetId: target.id,
    reason: values.reason,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return { ...target, ...values, moderatedBy: actor.uid, moderatedAt: new Date().toISOString() };
}

export async function createApplication(opportunity: Opportunity, user: SessionUser, message = "Me interesa participar.") {
  const firestore = requireDb();
  const id = `${opportunity.id}_${user.uid}`;
  const batch = writeBatch(firestore);
  batch.set(doc(firestore, "applications", id), {
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
  batch.set(doc(firestore, "notifications", `application_received_${id}`), {
    recipientId: opportunity.organizationId, actorId: user.uid, applicationId: id,
    type: "application_received", title: "Nueva persona interesada",
    message: `${user.displayName} quiere participar en ${opportunity.title}.`, read: false,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
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
  if (status === "accepted" || status === "rejected") {
    batch.set(doc(firestore, "notifications", `application_${status}_${application.id}`), {
      recipientId: application.userId, actorId: application.organizationId, applicationId: application.id,
      type: status === "accepted" ? "application_accepted" : "application_rejected",
      title: status === "accepted" ? "¡Tu participación fue aceptada!" : "Respuesta de la organización",
      message: status === "accepted" ? `Confirmaron tu lugar en ${application.opportunityTitle}.` : `La solicitud para ${application.opportunityTitle} no fue aceptada esta vez.`,
      read: false, createdAt: serverTimestamp(),
    });
  }
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
