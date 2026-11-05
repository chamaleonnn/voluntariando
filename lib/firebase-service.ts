import {
  GoogleAuthProvider,
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
  getDocs,
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
import type { AbsenceReport, AppNotification, Application, ExperienceFeedback, Invitation, Opportunity, OpportunityStatus, Organization, PlatformUser, Review, ReviewPhoto, ReviewReport, SessionUser, VolunteerProfile } from "@/lib/types";

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

  const suspensionUntil = stored?.suspendedUntil instanceof Timestamp ? stored.suspendedUntil.toDate() : null;
  const suspensionExpired = stored?.status === "suspended" && suspensionUntil && suspensionUntil.getTime() <= Date.now();
  if (stored?.status === "suspended" && !suspensionExpired) {
    const until = suspensionUntil;
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
        // Administración debe validar la organización antes de que publique oportunidades.
        status: "pending",
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
    batch.update(userRef, {
      lastLoginAt: serverTimestamp(),
      ...(bootstrapAdmin ? { role: "admin" } : {}),
      ...(suspensionExpired ? { status: "active", suspensionReason: null, suspendedUntil: null, updatedAt: serverTimestamp() } : {}),
    });
  }

  await batch.commit();
  return {
    uid: user.uid,
    email,
    displayName: user.displayName ?? email.split("@")[0] ?? "Usuario",
    role,
    status: stored?.status === "suspended" && !suspensionExpired ? "suspended" : "active",
  };
}

export function observeAuth(callback: (user: SessionUser | null) => void) {
  if (!auth || !db) return () => undefined;
  const firebaseAuth = auth;
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

  try {
    // El popup evita el bloqueo de almacenamiento cruzado que afecta a web.app en Chrome y Safari.
    const result = await signInWithPopup(auth, provider);
    window.localStorage.removeItem("voluntariando-requested-role");
    return await toSessionUser(result.user, role);
  } catch (error) {
    window.localStorage.removeItem("voluntariando-requested-role");
    if (auth.currentUser) await signOut(auth);
    throw error;
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

export function observeVisibleVolunteerProfiles(callback: (profiles: VolunteerProfile[]) => void, onError: (error: Error) => void) {
  if (!db) return () => undefined;
  const source = query(collection(db, "volunteerProfiles"), where("visibleToOrganizations", "==", true));
  return onSnapshot(source, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as VolunteerProfile))), onError);
}

export function observeVolunteerCommunity(callback: (profiles: VolunteerProfile[]) => void, onError: (error: Error) => void) {
  if (!db) return () => undefined;
  const source = query(collection(db, "volunteerProfiles"), where("visibleToVolunteers", "==", true));
  return onSnapshot(source, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as VolunteerProfile))), onError);
}

export function observeInvitations(user: SessionUser, callback: (items: Invitation[]) => void, onError: (error: Error) => void) {
  if (!db || user.isDemo) return () => undefined;
  const field = user.role === "organization" ? "organizationId" : "userId";
  const source = query(collection(db, "invitations"), where(field, "==", user.uid));
  return onSnapshot(source, (snapshot) => {
    const items = snapshot.docs.map((item) => mapDoc<Invitation>(item));
    callback(items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, onError);
}

export async function createInvitation(actor: SessionUser, organization: Organization, opportunity: Opportunity, volunteer: VolunteerProfile, message: string) {
  const firestore = requireDb();
  const invitationRef = doc(collection(firestore, "invitations"));
  const id = invitationRef.id;
  const batch = writeBatch(firestore);
  batch.set(invitationRef, {
    opportunityId: opportunity.id, opportunityTitle: opportunity.title,
    organizationId: organization.id, organizationName: organization.name, organizationContact: organization.contact ?? organization.email,
    userId: volunteer.id, userName: volunteer.name, message, status: "pending",
    createdAt: serverTimestamp(),
  });
  batch.set(doc(firestore, "notifications", `proposal_received_${id}`), {
    recipientId: volunteer.id, actorId: actor.uid, invitationId: id,
    type: "proposal_received", title: "Tenés una propuesta",
    message: `${organization.name} te invitó a ${opportunity.title}.`, read: false,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return { id, opportunityId: opportunity.id, opportunityTitle: opportunity.title, organizationId: organization.id, organizationName: organization.name, organizationContact: organization.contact ?? organization.email, userId: volunteer.id, userName: volunteer.name, message, status: "pending" as const, createdAt: new Date().toISOString() };
}

export async function updateInvitationStatus(actor: SessionUser, invitation: Invitation, status: "accepted" | "rejected") {
  const firestore = requireDb();
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, "invitations", invitation.id), { status, respondedAt: serverTimestamp() });
  if (status === "accepted") {
    batch.set(doc(firestore, "matches", `invitation_${invitation.id}`), {
      invitationId: invitation.id, opportunityId: invitation.opportunityId, opportunityTitle: invitation.opportunityTitle,
      organizationId: invitation.organizationId, userId: invitation.userId, source: "invitation", status: "confirmed",
      createdAt: serverTimestamp(),
    });
  }
  batch.set(doc(firestore, "notifications", `proposal_${status}_${invitation.id}`), {
    recipientId: invitation.organizationId, actorId: actor.uid, invitationId: invitation.id,
    type: status === "accepted" ? "proposal_accepted" : "proposal_rejected",
    title: status === "accepted" ? "Propuesta aceptada" : "Propuesta rechazada",
    message: `${invitation.userName} ${status === "accepted" ? "aceptó" : "rechazó"} la invitación a ${invitation.opportunityTitle}.`,
    read: false, createdAt: serverTimestamp(),
  });
  await batch.commit();
  return { ...invitation, status };
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

export function observeAdminFeedback(callback: (items: ExperienceFeedback[]) => void, onError: (error: Error) => void) {
  if (!db) return () => undefined;
  return onSnapshot(collection(db, "feedback"), (snapshot) => {
    const items = snapshot.docs.map((item) => mapDoc<ExperienceFeedback>(item));
    callback(items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, onError);
}

export function observeAdminAbsenceReports(callback: (items: AbsenceReport[]) => void, onError: (error: Error) => void) {
  if (!db) return () => undefined;
  return onSnapshot(collection(db, "absenceReports"), (snapshot) => {
    callback(snapshot.docs.map((item) => mapDoc<AbsenceReport>(item)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, onError);
}

export function observeAbsenceReports(userId: string, callback: (items: AbsenceReport[]) => void, onError: (error: Error) => void) {
  if (!db) return () => undefined;
  const source = query(collection(db, "absenceReports"), where("volunteerId", "==", userId));
  return onSnapshot(source, (snapshot) => callback(snapshot.docs.map((item) => mapDoc<AbsenceReport>(item)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))), onError);
}

export async function recordAbsence(application: Application, actor: SessionUser, organization: Organization, reason: string) {
  const firestore = requireDb();
  const matchId = application.matchId ?? `${application.opportunityId}_${application.userId}`;
  await runTransaction(firestore, async (transaction) => {
    const participationRef = doc(firestore, "participations", matchId);
    if ((await transaction.get(participationRef)).exists()) throw new Error("Esta participación ya tiene un resultado registrado.");
    const reportRef = doc(firestore, "absenceReports", matchId);
    transaction.update(doc(firestore, "matches", matchId), { status: "absence_pending_review", absentAt: serverTimestamp() });
    transaction.set(participationRef, {
      matchId, opportunityId: application.opportunityId, organizationId: application.organizationId,
      userId: application.userId, status: "absence_pending_review", reportedBy: actor.uid, reportedAt: serverTimestamp(),
    });
    transaction.set(reportRef, {
      matchId, opportunityId: application.opportunityId, opportunityTitle: application.opportunityTitle,
      organizationId: application.organizationId, organizationName: organization.name,
      volunteerId: application.userId, volunteerName: application.userName,
      reportedBy: actor.uid, reportedByEmail: actor.email, reason, status: "pending_review", createdAt: serverTimestamp(),
    });
    if (application.source === "invitation") transaction.update(doc(firestore, "invitations", application.id), { absentAt: serverTimestamp() });
    else transaction.update(doc(firestore, "applications", application.id), { absentAt: serverTimestamp(), updatedAt: serverTimestamp() });
    transaction.set(doc(firestore, "notifications", `absence_reported_${matchId}`), {
      recipientId: application.userId, actorId: actor.uid, absenceReportId: matchId,
      type: "absence_reported", title: "Ausencia informada",
      message: `La organización informó una ausencia en ${application.opportunityTitle}. Administración la revisará antes de aplicar consecuencias.`,
      read: false, createdAt: serverTimestamp(),
    });
  });
  return { ...application, absentAt: new Date().toISOString() };
}

export async function adminModerateAbsence(actor: SessionUser, report: AbsenceReport, status: "confirmed" | "dismissed", reason: string, suspensionDays: number) {
  const firestore = requireDb();
  const snapshot = await getDocs(collection(firestore, "absenceReports"));
  const previousConfirmed = snapshot.docs.map((item) => mapDoc<AbsenceReport>(item)).filter((item) => item.id !== report.id && item.volunteerId === report.volunteerId && item.status === "confirmed").length;
  const count = status === "confirmed" ? previousConfirmed + 1 : previousConfirmed;
  const shouldSuspend = status === "confirmed" && count >= 3;
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, "absenceReports", report.id), { status, reviewedAt: serverTimestamp(), reviewedBy: actor.uid, reviewReason: reason });
  batch.update(doc(firestore, "participations", report.matchId), { status: status === "confirmed" ? "absent" : "absence_dismissed", reviewedAt: serverTimestamp(), reviewedBy: actor.uid });
  batch.update(doc(firestore, "matches", report.matchId), { status: status === "confirmed" ? "absent" : "confirmed", reviewedAt: serverTimestamp(), reviewedBy: actor.uid });
  batch.set(doc(firestore, "notifications", `absence_resolved_${report.id}`), {
    recipientId: report.volunteerId, actorId: actor.uid, absenceReportId: report.id, type: "absence_resolved",
    title: status === "dismissed" ? "Ausencia descartada" : shouldSuspend ? "Suspensión temporal" : "Ausencia confirmada",
    message: status === "dismissed" ? "Administración descartó el reporte de ausencia." : shouldSuspend ? `Se confirmaron tres ausencias. La cuenta fue suspendida por ${Math.max(1, suspensionDays)} días.` : `Ausencias confirmadas: ${count} de 3.`,
    read: false, createdAt: serverTimestamp(),
  });
  if (shouldSuspend) batch.update(doc(firestore, "users", report.volunteerId), { status: "suspended", suspendedUntil: new Date(Date.now() + Math.max(1, suspensionDays) * 86400000), suspensionReason: "Tres ausencias confirmadas", moderatedBy: actor.uid, updatedAt: serverTimestamp() });
  batch.set(doc(collection(firestore, "adminActions")), { actorId: actor.uid, actorEmail: actor.email, action: status === "confirmed" ? "confirm_absence" : "dismiss_absence", targetType: "absenceReport", targetId: report.id, reason, createdAt: serverTimestamp() });
  await batch.commit();
  return { report: { ...report, status, reviewedBy: actor.uid, reviewedAt: new Date().toISOString(), reviewReason: reason }, suspended: shouldSuspend, confirmedCount: count };
}

// Una devolución negativa solo produce efectos luego de la revisión de administración.
export async function adminModerateFeedback(actor: SessionUser, feedback: ExperienceFeedback, status: "approved" | "dismissed", reason: string, suspensionDays: number) {
  const firestore = requireDb();
  const snapshot = await getDocs(collection(firestore, "feedback"));
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const previousApproved = snapshot.docs.map((item) => mapDoc<ExperienceFeedback>(item)).filter((item) =>
    item.id !== feedback.id
    && item.volunteerId === feedback.volunteerId
    && item.assessment === "needs_improvement"
    && item.status === "approved"
    && new Date(item.createdAt).getTime() >= cutoff
  ).length;
  const confirmedCount = status === "approved" ? previousApproved + 1 : previousApproved;
  const shouldSuspend = status === "approved" && confirmedCount >= 2;
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, "feedback", feedback.id), {
    status, moderationReason: reason, moderatedBy: actor.uid, moderatedAt: serverTimestamp(),
  });
  if (status === "approved") {
    batch.set(doc(firestore, "notifications", `feedback_warning_${feedback.id}`), {
      recipientId: feedback.volunteerId,
      actorId: actor.uid,
      feedbackId: feedback.id,
      type: "feedback_warning",
      title: shouldSuspend ? "Suspensión temporal" : "Orientación para tu próxima experiencia",
      message: shouldSuspend
        ? `Se confirmaron dos devoluciones dentro de tres meses. Tu cuenta fue suspendida temporalmente por ${Math.max(1, suspensionDays)} días.`
        : `Antes de tu próxima experiencia, tené en cuenta este aspecto a mejorar: ${feedback.details}`,
      read: false,
      createdAt: serverTimestamp(),
    });
  }
  if (shouldSuspend) {
    batch.update(doc(firestore, "users", feedback.volunteerId), {
      status: "suspended",
      suspendedUntil: new Date(Date.now() + Math.max(1, suspensionDays) * 24 * 60 * 60 * 1000),
      suspensionReason: "Dos devoluciones negativas confirmadas dentro de tres meses",
      moderatedBy: actor.uid,
      updatedAt: serverTimestamp(),
    });
  }
  batch.set(doc(collection(firestore, "adminActions")), {
    actorId: actor.uid,
    actorEmail: actor.email,
    action: status === "approved" ? "approve_negative_feedback" : "dismiss_negative_feedback",
    targetType: "feedback",
    targetId: feedback.id,
    reason,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return {
    feedback: { ...feedback, status, moderationReason: reason, moderatedBy: actor.uid, moderatedAt: new Date().toISOString() },
    suspended: shouldSuspend,
  };
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

// Administración ve también organizaciones pendientes o suspendidas.
export function observeAdminOrganizations(callback: (items: Organization[]) => void, onError: (error: Error) => void) {
  if (!db) return () => undefined;
  return onSnapshot(collection(db, "organizations"), (snapshot) => {
    callback(snapshot.docs.map((item) => mapDoc<Organization>(item)));
  }, onError);
}

// Valida o restringe una organización y deja constancia de la decisión.
export async function adminUpdateOrganization(
  actor: SessionUser,
  target: Organization,
  status: Organization["status"],
  reason: string,
) {
  const firestore = requireDb();
  const batch = writeBatch(firestore);
  const moderatedAt = new Date().toISOString();
  batch.update(doc(firestore, "organizations", target.id), {
    status,
    moderationReason: reason,
    moderatedBy: actor.uid,
    moderatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(collection(firestore, "adminActions")), {
    actorId: actor.uid,
    actorEmail: actor.email,
    action: status === "verified" ? "verify_organization" : "restrict_organization",
    targetType: "organization",
    targetId: target.id,
    reason,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return { ...target, status, moderationReason: reason, moderatedBy: actor.uid, moderatedAt };
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
  values: { tasks: string[]; skills: string[]; organizationName: string; submittedByEmail: string; assessment: "positive" | "needs_improvement"; details: string },
) {
  const firestore = requireDb();
  const matchId = application.matchId ?? `${application.opportunityId}_${application.userId}`;
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
      organizationName: values.organizationName,
      submittedByEmail: values.submittedByEmail,
      volunteerId: application.userId,
      volunteerName: application.userName,
      opportunityTitle: application.opportunityTitle,
      tasks: values.tasks,
      skills: values.skills,
      assessment: values.assessment,
      details: values.details,
      status: values.assessment === "needs_improvement" ? "pending_review" : "recorded",
      createdAt: serverTimestamp(),
    });
    transaction.update(doc(firestore, "matches", matchId), { status: "completed", completedAt: serverTimestamp() });
    if (application.source === "invitation") {
      transaction.update(doc(firestore, "invitations", application.id), { completedAt: serverTimestamp() });
    } else {
      transaction.update(doc(firestore, "applications", application.id), { completedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    transaction.set(profileRef, {
      verifiedSkills,
      experiences: [...(profile?.experiences ?? []), experience],
      completedExperiences: (profile?.completedExperiences ?? 0) + 1,
      lastExperienceMatchId: matchId,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
}
