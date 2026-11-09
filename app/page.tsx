"use client";

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ArrowRight, Ban, Bot, Building2, CalendarDays, Check, ChevronRight, CirclePlay, Clock3,
  ExternalLink, Globe2, LogOut, Map, MapPin, Moon, Pencil, Plus, Search, Settings2,
  Shield, ShieldCheck, Sparkles, Sun, UserRound, Users,
} from "lucide-react";
import { toast } from "sonner";

import { OpportunityMap } from "@/components/opportunity-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { ViaAvatar, type ViaState } from "@/components/via-avatar";
import { ViaMilestoneCelebration, ViaVideoWelcome, WelcomeTutorial } from "@/components/via-onboarding";
import { DEMO_APPLICATIONS, DEMO_OPPORTUNITIES, DEMO_REVIEW_REPORTS, DEMO_REVIEWS, DEMO_VOLUNTEERS } from "@/lib/demo-data";
import {
  adminModerateAbsence, adminModerateFeedback, adminModerateReview, adminModerateReviewPhoto, adminUpdateOpportunity, adminUpdateOrganization, adminUpdateUser, authErrorMessage, compressOpportunityPhoto, createApplication, createInvitation, createOpportunity, createReview, firebaseSignInWithGoogle, firebaseSignOut,
  observeAdminAbsenceReports, observeAdminFeedback, observeAdminOpportunities, observeAdminOrganizations, observeAdminReviewPhotos, observeAdminReviewReports, observeAdminReviews, observeAdminUsers, observeAbsenceReports, observeApplications, observeApprovedReviewPhotos, observeAuth, observeOpportunities, observeOrganizations,
  markNotificationRead, observeInvitations, observeNotifications, observeOrganizationProfile, observeReviews, observeVisibleVolunteerProfiles, observeVolunteerCommunity, observeVolunteerProfile, recordAbsence, recordCompletedExperience, reportReview, saveOrganizationProfile,
  saveVolunteerProfile, switchAccountRole, updateApplicationStatus, updateInvitationStatus, updateOpportunity,
} from "@/lib/firebase-service";
import { isFirebaseConfigured } from "@/lib/firebase";
import { analyzeSemanticCompatibility } from "@/lib/ai-service";
import { calculateCompatibility, recommendOpportunities } from "@/lib/recommendations";
import { viaMilestoneStorageKey, viaTutorialStorageKey, viaWelcomeStorageKey, type TutorialRole } from "@/lib/via-tutorial";
import type { AbsenceReport, AppNotification, Application, ExperienceFeedback, Invitation, Opportunity, OpportunityStatus, Organization, PlatformUser, Review, ReviewPhoto, ReviewReport, SessionUser, VolunteerProfile } from "@/lib/types";

type Screen = "landing" | "opportunities" | "volunteer" | "organization" | "admin";

const DEMO_USERS = {
  volunteer: { uid: "demo-volunteer", email: "sofia@demo.local", displayName: "Sofía Martínez", role: "volunteer", isDemo: true } as SessionUser,
  organization: { uid: "demo-organization", email: "equipo@fundemos.demo", displayName: "Fundemos", role: "organization", isDemo: true } as SessionUser,
  admin: { uid: "demo-admin", email: "admin@prototipo.demo", displayName: "Tao · Administrador", role: "admin", isDemo: true } as SessionUser,
};

const DEMO_ORGANIZATION: Organization = {
  id: "fundemos", ownerId: "demo-organization", name: "Fundemos", email: "equipo@fundemos.demo",
  province: "Córdoba", location: "Córdoba capital", contact: "equipo@fundemos.demo",
  description: "Organización orientada a proyectos comunitarios, ambientales y educativos.",
  imageUrl: "https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=900&q=80",
  socialLinks: {},
  areas: ["Ambiente", "Educación", "Asistencia comunitaria"], status: "verified",
};

const ORGANIZATION_AREA_OPTIONS = [
  "Ambiente",
  "Educación",
  "Deporte y recreación",
  "Arte y cultura",
  "Alimentación",
  "Asistencia comunitaria",
  "Salud y bienestar",
  "Tecnología y comunicación",
] as const;

const OPPORTUNITY_TIME_OPTIONS = [
  "09:00–12:00",
  "14:00–18:00",
  "09:00–17:00",
  "18:00–21:00",
] as const;

const AVAILABILITY_OPTIONS = [
  "Lunes a viernes por la mañana",
  "Lunes a viernes por la tarde",
  "Lunes a viernes por la noche",
  "Sábado por la mañana",
  "Sábado por la tarde",
  "Domingo por la mañana",
  "Flexible",
] as const;

const HIGH_COMPATIBILITY_MIN = 60;

const ARGENTINA_PROVINCES = [
  "Buenos Aires", "Ciudad Autónoma de Buenos Aires", "Catamarca", "Chaco", "Chubut",
  "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja",
  "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis",
  "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán",
] as const;

const DEFAULT_OPPORTUNITY_IMAGE = "https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1200&q=80";

// Catálogo neutral: son habilidades verificables, no recompensas ni niveles visuales.
const VERIFIED_SKILL_OPTIONS = [
  "Arte y creatividad",
  "Educación y acompañamiento",
  "Naturaleza y ambiente",
  "Cocina y alimentación",
  "Construcción y reparación",
  "Organización y logística",
  "Tecnología y comunicación",
  "Deporte, juego y recreación",
] as const;

function splitList(value: FormDataEntryValue | null) {
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

// Corrige espacios y mayúscula inicial sin alterar siglas, nombres propios ni el contenido escrito.
function readableText(value: FormDataEntryValue | null) {
  const clean = String(value ?? "").trim().replace(/\s+/g, " ");
  return clean ? clean.charAt(0).toLocaleUpperCase("es") + clean.slice(1) : "";
}

function readableList(value: FormDataEntryValue | null) {
  return splitList(value).map((item) => readableText(item));
}

// Protege la identidad en la comunidad: conserva el nombre y abrevia cada apellido.
function privateVolunteerName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || "Voluntario";
  return `${parts[0]} ${parts.slice(1).map((part) => `${part.charAt(0).toLocaleUpperCase("es")}.`).join(" ")}`;
}

// Muestra el usuario de Instagram compartido sin revelar información adicional del perfil.
function instagramLabel(value: string) {
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    const handle = url.pathname.split("/").filter(Boolean)[0]?.replace(/^@/, "");
    if (handle) return `Instagram · @${handle}`;
    const host = url.hostname.replace(/^www\./, "");
    return host && host !== "instagram.com" ? `Instagram · ${host}` : "Instagram";
  } catch {
    return "Instagram";
  }
}

function externalSocialUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function registerVerifiedSkills(current: Record<string, number>, skills: string[]) {
  return skills.reduce((levels, skill) => ({ ...levels, [skill]: (levels[skill] ?? 0) + 1 }), { ...current });
}

function screenForRole(role: SessionUser["role"]): Screen {
  if (role === "organization") return "organization";
  if (role === "admin") return "admin";
  return "volunteer";
}

function roleLabel(role: SessionUser["role"]) {
  return role === "organization" ? "Organización" : role === "admin" ? "Administrador" : "Voluntario";
}

function participationStatusLabel(status: Application["status"] | Invitation["status"]) {
  return status === "accepted" ? "Aceptada" : status === "rejected" ? "Rechazada" : status === "cancelled" ? "Cancelada" : "Pendiente";
}

// Solo una solicitud vigente o una experiencia ya registrada impiden volver a postularse.
function blocksNewApplication(application: Application) {
  return application.status === "pending" || application.status === "accepted" || Boolean(application.completedAt || application.absentAt);
}

// El acceso a la app se habilita solamente cuando existen los datos mínimos del perfil.
function volunteerProfileIsComplete(profile: VolunteerProfile) {
  return Boolean(
    profile.name.trim()
    && profile.location.trim()
    && profile.interests.length
    && (profile.declaredSkills ?? []).length
    && (profile.availability ?? []).length,
  );
}

function organizationProfileIsComplete(organization: Organization) {
  return Boolean(
    organization.name.trim()
    && organization.province.trim()
    && organization.location?.trim()
    && organization.contact?.trim()
    && organization.description.trim()
    && (organization.areas ?? []).length,
  );
}

// Perfil vacío temporal: evita mostrar datos del usuario demo mientras Firebase carga la cuenta real.
function emptyVolunteerProfile(user: SessionUser): VolunteerProfile {
  return {
    id: user.uid,
    name: user.displayName,
    initials: user.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2),
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
  };
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [selectedPublicOrganization, setSelectedPublicOrganization] = useState<Organization | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>(DEMO_OPPORTUNITIES);
  const [applications, setApplications] = useState<Application[]>(DEMO_APPLICATIONS);
  const [reviews, setReviews] = useState<Review[]>(DEMO_REVIEWS);
  const [reviewPhotos, setReviewPhotos] = useState<ReviewPhoto[]>([]);
  const [profile, setProfile] = useState<VolunteerProfile>(DEMO_VOLUNTEERS[0]);
  const [profileLoadedFor, setProfileLoadedFor] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([DEMO_ORGANIZATION]);
  const [organizationProfile, setOrganizationProfile] = useState<Organization | null>(null);
  const [organizationLoadedFor, setOrganizationLoadedFor] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [absenceReports, setAbsenceReports] = useState<AbsenceReport[]>([]);
  const [volunteers, setVolunteers] = useState<VolunteerProfile[]>(DEMO_VOLUNTEERS);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [viaWelcomeOpen, setViaWelcomeOpen] = useState(false);
  const [viaPromptToken, setViaPromptToken] = useState(0);
  const [tutorialPreviewRole, setTutorialPreviewRole] = useState<TutorialRole | null>(null);
  const [tutorialPreviewChoiceOpen, setTutorialPreviewChoiceOpen] = useState(false);
  const [viaMilestoneRole, setViaMilestoneRole] = useState<TutorialRole | null>(null);
  useEffect(() => {
    const saved = window.localStorage.getItem("red-cercana-theme");
    const preferred = saved === "dark" || saved === "light"
      ? saved
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = preferred;
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(pointer: fine)");
    if (reduceMotion.matches || !finePointer.matches) return;

    let frame = 0;
    let currentX = window.innerWidth * 0.72;
    let currentY = window.innerHeight * 0.22;
    let targetX = currentX;
    let targetY = currentY;
    const move = (event: PointerEvent) => { targetX = event.clientX; targetY = event.clientY; };
    const animate = () => {
      currentX += (targetX - currentX) * 0.075;
      currentY += (targetY - currentY) * 0.075;
      document.documentElement.style.setProperty("--cursor-x", `${currentX}px`);
      document.documentElement.style.setProperty("--cursor-y", `${currentY}px`);
      frame = window.requestAnimationFrame(animate);
    };
    window.addEventListener("pointermove", move, { passive: true });
    frame = window.requestAnimationFrame(animate);
    return () => { window.removeEventListener("pointermove", move); window.cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => observeAuth((nextUser) => {
    setProfileLoadedFor(null);
    setOrganizationLoadedFor(null);
    setOrganizationProfile(null);
    if (nextUser?.role === "volunteer") setProfile(nextUser.isDemo ? DEMO_VOLUNTEERS[0] : emptyVolunteerProfile(nextUser));
    setUser(nextUser);
    if (nextUser) {
      setScreen(screenForRole(nextUser.role));
      setViaWelcomeOpen(false);
      setTutorialOpen(false);
    } else {
      setViaWelcomeOpen(false);
    }
  }), []);

  useEffect(() => {
    const message = window.localStorage.getItem("voluntariando-auth-error");
    if (!message) return;
    window.localStorage.removeItem("voluntariando-auth-error");
    toast.error("No pudimos iniciar sesión", { description: message });
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const fail = (error: Error) => console.error("Lectura pública de Firebase", error);
    const stopOpportunities = observeOpportunities((items) => {
      if (!items.length) return;
      // Durante el piloto completamos el catálogo real con oportunidades simuladas identificadas.
      const simulatedIds = new Set(DEMO_OPPORTUNITIES.map((item) => item.id));
      const visibleItems = items.map((item) => simulatedIds.has(item.id) ? { ...item, simulated: true } : item);
      const ids = new Set(items.map((item) => item.id));
      setOpportunities([...visibleItems, ...DEMO_OPPORTUNITIES.filter((item) => !ids.has(item.id))]);
    }, fail);
    const stopOrganizations = observeOrganizations((items) => { if (items.length) setOrganizations(items); }, fail);
    const stopReviews = observeReviews((items) => setReviews([...items, ...DEMO_REVIEWS.filter((demo) => !items.some((item) => item.id === demo.id))]), fail);
    const stopReviewPhotos = observeApprovedReviewPhotos(setReviewPhotos, fail);
    return () => { stopOpportunities(); stopOrganizations(); stopReviews(); stopReviewPhotos(); };
  }, []);

  useEffect(() => {
    if (!user || user.isDemo) return;
    const fail = (error: Error) => console.error("Sincronización privada", error);
    const stops = [observeApplications(user, setApplications, fail), observeNotifications(user.uid, setNotifications, fail), observeInvitations(user, setInvitations, fail)];
    if (user.role === "volunteer") {
      stops.push(observeAbsenceReports(user.uid, setAbsenceReports, fail));
      stops.push(observeVolunteerCommunity(setVolunteers, fail));
      // Si la persona también administra una organización, conservamos el acceso al volver a entrar.
      stops.push(observeOrganizationProfile(user.uid, setOrganizationProfile));
      stops.push(observeVolunteerProfile(user.uid, (next) => {
        if (next) setProfile(next);
        setProfileLoadedFor(user.uid);
      }));
    }
    if (user.role === "organization") {
      stops.push(observeVisibleVolunteerProfiles(setVolunteers, fail));
      stops.push(observeOrganizationProfile(user.uid, (next) => {
        setOrganizationProfile(next);
        setOrganizationLoadedFor(user.uid);
        if (next) setOrganizations((current) => [...current.filter((item) => item.id !== next.id), next]);
      }));
    }
    return () => stops.forEach((stop) => stop());
  }, [user]);

  async function readNotification(item: AppNotification) {
    if (!item.read) {
      setNotifications((current) => current.map((notification) => notification.id === item.id ? { ...notification, read: true } : notification));
      if (user && !user.isDemo) await markNotificationRead(item.id).catch(() => undefined);
    }
    // Las notificaciones nuevas guardan la oportunidad directamente. Para las
    // anteriores se recupera desde su invitación o postulación asociada.
    const invitation = item.invitationId ? invitations.find((current) => current.id === item.invitationId) : undefined;
    const application = item.applicationId ? applications.find((current) => current.id === item.applicationId) : undefined;
    const opportunityId = item.opportunityId ?? invitation?.opportunityId ?? application?.opportunityId;
    const opportunity = opportunityId ? opportunities.find((current) => current.id === opportunityId) : undefined;
    if (opportunity) {
      const personalized = user?.role === "volunteer" && profile
        ? recommendOpportunities([opportunity], profile)[0]
        : opportunity;
      setSelectedOpportunity(personalized);
      setScreen("opportunities");
    }
  }

  const recommended = useMemo(
    () => recommendOpportunities(opportunities, user?.role === "volunteer" ? profile : null),
    [opportunities, profile, user?.role],
  );

  function navigate(next: Screen) {
    if (tutorialPreviewRole && user?.role === "admin" && (next === tutorialPreviewRole || next === "opportunities" || next === "admin")) {
      setScreen(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if ((next === "volunteer" || next === "organization" || next === "admin") && !user) return setAuthOpen(true);
    if (next === "volunteer" && user?.role !== "volunteer") return toast.info("Este panel corresponde al perfil de voluntario.");
    if (next === "organization" && user?.role !== "organization") return toast.info("Este panel corresponde a una organización.");
    if (next === "admin" && user?.role !== "admin") return toast.info("Este panel corresponde a administración.");
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function loginAs(nextUser: SessionUser) {
    setProfileLoadedFor(null);
    setOrganizationLoadedFor(null);
    setOrganizationProfile(null);
    if (nextUser.role === "volunteer") {
      // Entre roles demo conservamos las acciones realizadas durante la demostración.
      if (!nextUser.isDemo) setProfile(emptyVolunteerProfile(nextUser));
      else if (!user?.isDemo) setProfile(DEMO_VOLUNTEERS[0]);
    }
    setUser(nextUser);
    setAuthOpen(false);
    setScreen(screenForRole(nextUser.role));
    setViaWelcomeOpen(false);
    setTutorialOpen(false);
    toast.success(`Entraste como ${nextUser.displayName}`);
  }

  function signOut() {
    // La interfaz sale de inmediato mientras Firebase limpia la sesión.
    void firebaseSignOut().catch(() => undefined);
    setUser(null);
    setProfileLoadedFor(null);
    setOrganizationLoadedFor(null);
    setOrganizationProfile(null);
    setViaWelcomeOpen(false);
    setScreen("landing");
  }

  async function changeAccountRole(nextRole: "volunteer" | "organization") {
    if (!user || user.role === "admin") return;
    try {
      const nextUser = user.isDemo
        ? { ...user, role: nextRole }
        : await switchAccountRole(user, nextRole, emptyVolunteerProfile({ ...user, role: "volunteer" }));
      setProfileLoadedFor(null);
      setOrganizationLoadedFor(null);
      if (nextRole === "volunteer") setProfile(emptyVolunteerProfile(nextUser));
      setUser(nextUser);
      setScreen(screenForRole(nextRole));
      toast.success(nextRole === "volunteer" ? "Ahora estás usando tu perfil de voluntario" : "Volviste a administrar tu organización");
    } catch (error) {
      toast.error("No pudimos cambiar el perfil", { description: error instanceof Error ? error.message : "Intentá nuevamente." });
    }
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("red-cercana-theme", next);
  }

  async function apply(opportunity: Opportunity) {
    if (!user) { setSelectedOpportunity(null); setAuthOpen(true); return; }
    if (user.role !== "volunteer") return toast.info("Ingresá como voluntario para mostrar interés.");
    const previous = applications.find((item) => item.opportunityId === opportunity.id && item.userId === user.uid);
    if (previous && blocksNewApplication(previous)) return toast.info("Ya mostraste interés en esta oportunidad.");
    const next: Application = {
      id: `${opportunity.id}_${user.uid}`, opportunityId: opportunity.id, opportunityTitle: opportunity.title,
      organizationId: opportunity.organizationId, userId: user.uid, userName: user.displayName,
      userEmail: user.email, message: "Me interesa participar.", status: "pending", createdAt: new Date().toISOString(),
    };
    try {
      if (!user.isDemo) await createApplication(opportunity, user, "Me interesa participar.", previous);
      setApplications((current) => [...current.filter((item) => item.id !== next.id), next]);
      setSelectedOpportunity(null);
      toast.success("Interés registrado", { description: "La organización podrá aceptar o rechazar la solicitud." });
    } catch (error) {
      toast.error("No pudimos registrar el interés", { description: error instanceof Error ? error.message : "Intentá nuevamente." });
    }
  }

  const organization = user?.role === "organization"
    ? organizationProfile ?? organizations.find((item) => item.id === user.uid || (user.isDemo && item.id === "fundemos")) ?? DEMO_ORGANIZATION
    : DEMO_ORGANIZATION;
  const volunteerOnboarding = Boolean(
    user && !user.isDemo && user.role === "volunteer"
    && profileLoadedFor === user.uid && !volunteerProfileIsComplete(profile),
  );
  const organizationOnboarding = Boolean(
    user && !user.isDemo && user.role === "organization"
    && organizationLoadedFor === user.uid && organizationProfile && !organizationProfileIsComplete(organizationProfile),
  );

  useEffect(() => {
    if (!user || user.isDemo || user.role === "admin") return;
    const ready = user.role === "volunteer"
      ? profileLoadedFor === user.uid && volunteerProfileIsComplete(profile)
      : organizationLoadedFor === user.uid && Boolean(organizationProfile && organizationProfileIsComplete(organizationProfile));
    if (!ready) return;
    const welcomeKey = viaWelcomeStorageKey(user.uid);
    const tutorialKey = viaTutorialStorageKey(user.uid, user.role);
    const timer = window.setTimeout(() => {
      if (!window.localStorage.getItem(welcomeKey)) setViaWelcomeOpen(true);
      else if (!window.localStorage.getItem(tutorialKey)) setTutorialOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user, profile, profileLoadedFor, organizationProfile, organizationLoadedFor]);

  useEffect(() => {
    if (!user || user.isDemo || user.role !== "volunteer" || profileLoadedFor !== user.uid) return;
    const hasConfirmedLink = applications.some((item) => item.userId === user.uid && item.status === "accepted")
      || invitations.some((item) => item.userId === user.uid && item.status === "accepted");
    if (!hasConfirmedLink) return;
    if (viaWelcomeOpen || tutorialOpen || authOpen || viaMilestoneRole) return;
    const key = viaMilestoneStorageKey(user.uid, "volunteer");
    if (window.localStorage.getItem(key)) return;
    const timer = window.setTimeout(() => {
      setViaMilestoneRole("volunteer");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [applications, authOpen, invitations, profileLoadedFor, tutorialOpen, user, viaMilestoneRole, viaWelcomeOpen]);

  useEffect(() => {
    if (!user || user.isDemo || user.role !== "organization" || organizationLoadedFor !== user.uid) return;
    const hasConfirmedLink = applications.some((item) => item.organizationId === user.uid && item.status === "accepted")
      || invitations.some((item) => item.organizationId === user.uid && item.status === "accepted");
    if (!hasConfirmedLink || viaWelcomeOpen || tutorialOpen || authOpen || viaMilestoneRole) return;
    const key = viaMilestoneStorageKey(user.uid, "organization");
    if (window.localStorage.getItem(key)) return;
    const timer = window.setTimeout(() => setViaMilestoneRole("organization"), 0);
    return () => window.clearTimeout(timer);
  }, [applications, authOpen, invitations, organizationLoadedFor, tutorialOpen, user, viaMilestoneRole, viaWelcomeOpen]);

  function celebrateOrganizationLink() {
    if (!user || user.isDemo || user.role !== "organization") return;
    const key = viaMilestoneStorageKey(user.uid, "organization");
    if (window.localStorage.getItem(key)) return;
    setViaMilestoneRole("organization");
  }

  function closeViaMilestone() {
    if (user && !user.isDemo && user.role !== "admin" && viaMilestoneRole) {
      window.localStorage.setItem(viaMilestoneStorageKey(user.uid, viaMilestoneRole), "shown");
    }
    setViaMilestoneRole(null);
  }

  function finishTutorial(showVia: boolean) {
    if (user && !user.isDemo && user.role !== "admin") window.localStorage.setItem(viaTutorialStorageKey(user.uid, user.role), "done");
    setTutorialOpen(false);
    if (user?.role === "admin" && tutorialPreviewRole) {
      setTutorialPreviewRole(null);
      setScreen("admin");
      return;
    }
    if (showVia && user?.role === "volunteer") setViaPromptToken((current) => current + 1);
  }

  function finishViaWelcome(startTour: boolean) {
    if (user && user.role !== "admin") {
      window.localStorage.setItem(viaWelcomeStorageKey(user.uid), "done");
      if (!startTour) window.localStorage.setItem(viaTutorialStorageKey(user.uid, user.role), "skipped");
    }
    setViaWelcomeOpen(false);
    if (!startTour && user?.role === "admin" && tutorialPreviewRole) {
      setTutorialPreviewRole(null);
      setScreen("admin");
      return;
    }
    if (startTour) setTutorialOpen(true);
  }

  function startAdminTutorialPreview(role: TutorialRole) {
    setTutorialPreviewRole(role);
    setTutorialPreviewChoiceOpen(false);
    setTutorialOpen(false);
    setScreen(role);
    setViaWelcomeOpen(true);
  }

  function startAdminMilestonePreview(role: TutorialRole) {
    setTutorialPreviewChoiceOpen(false);
    setViaMilestoneRole(role);
  }

  return (
    <main className="site-shell">
      <div className="ambient-background" aria-hidden="true"><span className="ambient-orb ambient-orb-one" /><span className="ambient-orb ambient-orb-two" /><span className="ambient-orb ambient-orb-three" /></div>
      {/* Los avisos aparecen debajo del encabezado para no bloquear la navegación. */}
      <Toaster position="top-center" offset={90} richColors />
      <SiteHeader screen={screen} user={user} notifications={notifications} onReadNotification={readNotification} onTutorial={() => { if (user?.role === "admin") setTutorialPreviewChoiceOpen(true); else { setTutorialOpen(false); setViaWelcomeOpen(true); } }} onTheme={toggleTheme} onNavigate={navigate} onLogin={() => setAuthOpen(true)} onSignOut={signOut} />
      <div className="screen-stage" key={screen}>
        {screen === "landing" && <Landing opportunities={opportunities} reviews={reviews} reviewPhotos={reviewPhotos} user={user} onExplore={() => navigate("opportunities")} onLogin={() => setAuthOpen(true)} onAccount={() => user && navigate(screenForRole(user.role))} />}
        {screen === "opportunities" && <OpportunityFeed opportunities={recommended} user={user} onOpen={setSelectedOpportunity} />}
        {screen === "volunteer" && user?.role === "volunteer" && !user.isDemo && profileLoadedFor !== user.uid && <ProfileLoading />}
        {screen === "volunteer" && user?.role === "admin" && tutorialPreviewRole === "volunteer" && (
          <VolunteerPanel user={DEMO_USERS.volunteer} profile={DEMO_VOLUNTEERS[0]} applications={DEMO_APPLICATIONS} invitations={[]} absenceReports={[]} community={DEMO_VOLUNTEERS} organizations={organizations} reviews={DEMO_REVIEWS} opportunities={recommendOpportunities(opportunities, DEMO_VOLUNTEERS[0])} onInvitations={() => undefined} onProfile={() => undefined} onReview={() => undefined} onExplore={() => navigate("opportunities")} onViewOrganization={setSelectedPublicOrganization} />
        )}
        {screen === "volunteer" && user?.role === "volunteer" && (user.isDemo || profileLoadedFor === user.uid) && (
          <VolunteerPanel user={user} profile={profile} applications={applications} invitations={invitations} absenceReports={absenceReports} community={volunteers} organizations={organizations} reviews={reviews} opportunities={recommended} onInvitations={setInvitations} onProfile={setProfile} onReview={(next) => setReviews((current) => [next, ...current.filter((item) => item.id !== next.id)])} onExplore={() => navigate("opportunities")} onViewOrganization={setSelectedPublicOrganization} canReturnToOrganization={organizationProfile?.ownerId === user.uid || organizations.some((item) => item.id === user.uid && item.ownerId === user.uid)} onSwitchRole={() => void changeAccountRole("organization")} />
        )}
        {screen === "organization" && user?.role === "organization" && !user.isDemo && organizationLoadedFor !== user.uid && <ProfileLoading />}
        {screen === "organization" && user?.role === "admin" && tutorialPreviewRole === "organization" && (
          <OrganizationPanel user={DEMO_USERS.organization} organization={DEMO_ORGANIZATION} opportunities={DEMO_OPPORTUNITIES} applications={DEMO_APPLICATIONS} invitations={[]} volunteers={DEMO_VOLUNTEERS} onOrganization={() => undefined} onOpportunities={() => undefined} onApplications={() => undefined} onInvitations={() => undefined} onProfile={() => undefined} onFirstLink={() => undefined} />
        )}
        {screen === "organization" && user?.role === "organization" && (user.isDemo || organizationLoadedFor === user.uid) && (
          <OrganizationPanel
            user={user} organization={organization} opportunities={opportunities} applications={applications} invitations={invitations} volunteers={volunteers}
            onOrganization={(next) => setOrganizations((current) => [...current.filter((item) => item.id !== next.id), next])}
            onOpportunities={setOpportunities} onApplications={setApplications} onInvitations={setInvitations} onProfile={setProfile}
            onFirstLink={celebrateOrganizationLink} onSwitchRole={() => void changeAccountRole("volunteer")}
          />
        )}
        {screen === "admin" && user?.role === "admin" && <AdminPanel user={user} opportunities={opportunities} reviews={reviews} />}
      </div>
      <GuideAssistant user={user} profile={profile} opportunities={recommended} promptToken={viaPromptToken} onOpenOpportunity={setSelectedOpportunity} />
      <OpportunityDialog key={selectedOpportunity?.id ?? "no-opportunity"} opportunity={selectedOpportunity} user={user} applications={applications} open={Boolean(selectedOpportunity)} onOpenChange={(open) => !open && setSelectedOpportunity(null)} onApply={apply} onViewOrganization={(organizationId) => { const target = organizations.find((item) => item.id === organizationId); if (target) { setSelectedOpportunity(null); setSelectedPublicOrganization(target); } }} />
      <PublicOrganizationDialog organization={selectedPublicOrganization} opportunities={opportunities} open={Boolean(selectedPublicOrganization)} onOpenChange={(open) => !open && setSelectedPublicOrganization(null)} />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} onUser={loginAs} />
      {user?.role === "volunteer" && !user.isDemo && <VolunteerProfileDialog user={user} profile={profile} open={volunteerOnboarding} onOpenChange={() => undefined} onSaved={setProfile} mandatory />}
      {user?.role === "organization" && !user.isDemo && <OrganizationProfileDialog user={user} organization={organization} open={organizationOnboarding} onOpenChange={() => undefined} onSaved={(next) => { setOrganizationProfile(next); setOrganizations((current) => [...current.filter((item) => item.id !== next.id), next]); }} mandatory />}
      {user && (user.role !== "admin" || tutorialPreviewRole) && <ViaVideoWelcome role={tutorialPreviewRole ?? user.role as TutorialRole} open={viaWelcomeOpen} onOmit={() => finishViaWelcome(false)} onStartTour={() => finishViaWelcome(true)} />}
      {user && (user.role !== "admin" || tutorialPreviewRole) && <WelcomeTutorial role={tutorialPreviewRole ?? user.role as TutorialRole} open={tutorialOpen} screen={screen} onNavigate={navigate} onOpenChange={setTutorialOpen} onFinish={finishTutorial} />}
      <ViaMilestoneCelebration role={viaMilestoneRole ?? "volunteer"} open={Boolean(viaMilestoneRole)} onClose={closeViaMilestone} />
      <Dialog open={tutorialPreviewChoiceOpen} onOpenChange={setTutorialPreviewChoiceOpen}><DialogContent><DialogHeader><DialogTitle>Vista previa de Vía</DialogTitle><DialogDescription>Probá sus recorridos y celebraciones con datos simulados. No se modifica tu rol ni información real.</DialogDescription></DialogHeader><div className="tutorial-role-options"><Button onClick={() => startAdminTutorialPreview("volunteer")}><UserRound /> Tutorial de voluntario</Button><Button variant="outline" onClick={() => startAdminTutorialPreview("organization")}><Building2 /> Tutorial de organización</Button><Button variant="outline" onClick={() => startAdminMilestonePreview("volunteer")}><Sparkles /> Celebración del voluntario</Button><Button variant="outline" onClick={() => startAdminMilestonePreview("organization")}><Sparkles /> Celebración de la organización</Button></div></DialogContent></Dialog>
    </main>
  );
}

function ProfileLoading() {
  return <section className="profile-loading" role="status"><span className="profile-loading-mark"><Sparkles /></span><h1>Preparando tu espacio…</h1><p>Estamos cargando tu perfil de forma segura.</p></section>;
}

function SiteHeader({ screen, user, notifications, onReadNotification, onTutorial, onTheme, onNavigate, onLogin, onSignOut }: {
  screen: Screen; user: SessionUser | null; notifications: AppNotification[]; onReadNotification: (item: AppNotification) => void; onTutorial: () => void; onTheme: () => void; onNavigate: (screen: Screen) => void; onLogin: () => void; onSignOut: () => void;
}) {
  const account = user ? screenForRole(user.role) : "volunteer";
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const unread = notifications.filter((item) => !item.read).length;
  return <><header className="site-header">
    <button className="brand" onClick={() => onNavigate("landing")}><span className="brand-mark"><Image src="/brand/icon-voluntariando-64.png" alt="" width={64} height={64} priority /></span><span>Voluntariando<small>encontrá dónde ayudar</small></span></button>
    <nav className="main-nav" aria-label="Navegación principal"><button className={screen === "landing" ? "active" : ""} onClick={() => onNavigate("landing")}>Inicio</button><button className={screen === "opportunities" ? "active" : ""} onClick={() => onNavigate("opportunities")}>Oportunidades</button>{user && <button className={screen === account ? "active" : ""} onClick={() => onNavigate(account)}>Mi espacio</button>}</nav>
    <div className="header-account"><Button className="theme-toggle" variant="ghost" size="icon" onClick={onTheme} aria-label="Cambiar tema de color"><Moon className="theme-icon-light" /><Sun className="theme-icon-dark" /></Button>{user ? <><button className="tutorial-button" onClick={onTutorial} aria-label={user.role === "admin" ? "Probar tutorial de Vía" : "Abrir tutorial"}>?</button><button className="notification-button" onClick={() => setNotificationsOpen(true)} aria-label={`${unread} notificaciones sin leer`}><span aria-hidden="true">🔔</span>{unread > 0 && <b>{unread}</b>}</button><span className="account-chip" title={user.role === "volunteer" ? "Voluntario" : user.role === "organization" ? "Organización" : "Administrador"}><span>{user.displayName.charAt(0)}</span><b>{user.displayName}</b></span><Button variant="ghost" size="icon" onClick={onSignOut} aria-label="Cerrar sesión"><LogOut /></Button></> : <Button className="soft-button" onClick={onLogin}>Ingresar</Button>}</div>
  </header><NotificationDialog notifications={notifications} open={notificationsOpen} onOpenChange={setNotificationsOpen} onRead={onReadNotification} /></>;
}

function NotificationDialog({ notifications, open, onOpenChange, onRead }: { notifications: AppNotification[]; open: boolean; onOpenChange: (open: boolean) => void; onRead: (item: AppNotification) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="notification-dialog"><DialogHeader><DialogTitle>Notificaciones</DialogTitle><DialogDescription>Solicitudes y respuestas de tus participaciones.</DialogDescription></DialogHeader><div className="notification-list">{notifications.map((item) => <button key={item.id} className={item.read ? "read" : ""} onClick={() => { onRead(item); onOpenChange(false); }}><span>{item.type === "application_received" ? "👤" : item.type === "application_accepted" ? "✓" : "↪"}</span><div><b>{item.title}</b><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleDateString("es-AR")}{(item.opportunityId || item.invitationId || item.applicationId) ? " · Ver oportunidad" : ""}</small></div>{!item.read && <i />}</button>)}{!notifications.length && <p className="panel-note">Todavía no tenés notificaciones.</p>}</div><DialogFooter><Button onClick={() => onOpenChange(false)}>Cerrar</Button></DialogFooter></DialogContent></Dialog>;
}

function Landing({ opportunities, reviews, reviewPhotos, user, onExplore, onLogin, onAccount }: { opportunities: Opportunity[]; reviews: Review[]; reviewPhotos: ReviewPhoto[]; user: SessionUser | null; onExplore: () => void; onLogin: () => void; onAccount: () => void }) {
  const [guide, setGuide] = useState<number | null>(null);
  const [reportedReview, setReportedReview] = useState<Review | null>(null);
  const steps = [
    { title: "Creá tu perfil", text: "Registrá intereses, habilidades y ubicación.", videoSrc: "/videos/crear-perfil.mp4", posterSrc: "/videos/crear-perfil.png" },
    { title: "Recibí recomendaciones", text: "Vía te muestra qué oportunidades pueden encajar mejor con vos.", videoSrc: "/videos/recibir-recomendaciones.mp4", posterSrc: "/videos/recibir-recomendaciones.png" },
    { title: "Mostrá interés", text: "La organización acepta o rechaza la solicitud.", videoSrc: "/videos/mostrar-interes.mp4", posterSrc: "/videos/mostrar-interes.png" },
    { title: "Sumá experiencia", text: "Las habilidades verificadas actualizan tu trayectoria.", videoSrc: "/videos/sumar-experiencia.mp4", posterSrc: "/videos/sumar-experiencia.png" },
  ];
  return <>
    <section className="hero-section document-hero">
      <div className="hero-copy"><Badge className="hero-kicker"><Sparkles /> Voluntariado que deja huella</Badge><h1>Conectamos personas que quieren ayudar con oportunidades de voluntariado.</h1><p>Descubrí, postuláte y construí una trayectoria que mejora tus próximas recomendaciones.</p><div className="hero-actions"><Button size="lg" onClick={onExplore}>Explorar oportunidades <ArrowRight /></Button><Button size="lg" variant="outline" onClick={user ? onAccount : onLogin}>{user ? "Ir a mi espacio" : "Ingresar con Google"}</Button></div><span className="hero-note"><ShieldCheck /> {user ? `Sesión iniciada como ${user.displayName}.` : "Las oportunidades se pueden explorar sin iniciar sesión."}</span></div>
      <div className="landing-opportunity-showcase">{opportunities.slice(0, 3).map((item) => <article key={item.id}><div style={{ backgroundImage: `url(${item.imageUrl})` }} /><span>{item.category}</span>{item.simulated && <SimulatedSeal />}<h3>{item.title}</h3><p><MapPin /> {item.neighborhood}, {item.province}</p></article>)}</div>
    </section>
    <section className="how-section"><div className="section-heading"><span>Cómo funciona</span><h2>De la oportunidad a una nueva experiencia</h2><p>Elegí un paso para ver su recorrido animado.</p></div><div className="steps-row">{steps.map((step, index) => <Step key={step.title} number={String(index + 1)} title={step.title} text={step.text} onOpen={() => setGuide(index)} />)}</div></section>
    <section className="reviews-section"><div className="section-heading"><span>Experiencias reales</span><h2>Lo cuentan quienes participaron</h2><p>Reseñas públicas de experiencias completadas.</p></div><div className="review-grid">{reviews.slice(0, 6).map((review) => { const photo = reviewPhotos.find((item) => item.reviewId === review.id); return <article key={review.id}>{photo && <Image className="review-photo" src={photo.imageDataUrl} alt={`Foto de ${review.opportunityTitle}`} width={640} height={320} unoptimized />}<div className="review-stars" aria-label={`${review.rating} de 5 estrellas`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div><p>“{review.comment}”</p><footer><span><b>{review.authorName}</b><small>{review.opportunityTitle} · {review.organizationName}</small></span><button onClick={() => user ? setReportedReview(review) : onLogin()}><Ban /> Denunciar</button></footer></article>; })}</div></section>
    <section className="landing-cta"><div><span><Globe2 /> Plataforma de alcance global</span><h2>El piloto comienza en Córdoba.</h2><p>Córdoba aporta los primeros casos de la tesis, pero la ubicación no limita el uso del sistema.</p></div><Button size="lg" onClick={onExplore}>Ver oportunidades <ChevronRight /></Button></section>
    <StepGuideDialog step={guide === null ? null : steps[guide]} number={guide === null ? 0 : guide + 1} open={guide !== null} onOpenChange={(open) => !open && setGuide(null)} />
    <ReviewReportDialog user={user} review={reportedReview} open={Boolean(reportedReview)} onOpenChange={(open) => !open && setReportedReview(null)} />
  </>;
}

function SimulatedSeal() {
  return <span className="simulated-seal" title="Caso inventado para la demostración">👁️‍🗨️ Simulada</span>;
}

function Step({ number, title, text, onOpen }: { number: string; title: string; text: string; onOpen: () => void }) {
  return <button className="step-card" onClick={onOpen}><span>{number}</span><div><h3>{title}</h3><p>{text}</p><small><CirclePlay /> Ver paso a paso</small></div></button>;
}

function StepGuideDialog({ step, number, open, onOpenChange }: { step: { title: string; text: string; videoSrc: string; posterSrc: string } | null; number: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!step) return null;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="guide-dialog"><DialogHeader><DialogTitle>Paso {number}: {step.title}</DialogTitle><DialogDescription>{step.text}</DialogDescription></DialogHeader><video className="walkthrough-player" src={step.videoSrc} poster={step.posterSrc} controls autoPlay muted playsInline preload="metadata">Tu navegador no puede reproducir este video.</video><p className="video-caption">Video de 15 segundos · sin audio · texto paso a paso</p><DialogFooter><Button onClick={() => onOpenChange(false)}>Entendido</Button></DialogFooter></DialogContent></Dialog>;
}

function OpportunityFeed({ opportunities, user, onOpen }: { opportunities: Opportunity[]; user: SessionUser | null; onOpen: (item: Opportunity) => void }) {
  const [query, setQuery] = useState("");
  const [province, setProvince] = useState("Todas");
  const [modality, setModality] = useState("Todas");
  const [showMap, setShowMap] = useState(false);
  const provinces = ["Todas", ...new Set(opportunities.map((item) => item.province))];
  const filtered = opportunities.filter((item) => {
    const term = query.toLocaleLowerCase("es");
    return (!term || `${item.title} ${item.organization} ${item.category}`.toLocaleLowerCase("es").includes(term))
      && (province === "Todas" || item.province === province)
      && (modality === "Todas" || item.modality === modality);
  });
  return <section className="feed-page" data-tour="opportunity-feed"><div className="feed-intro"><div><span><Sparkles /> {user?.role === "volunteer" ? "Recomendaciones para vos" : "Oportunidades disponibles"}</span><h1>Encontrá dónde participar</h1><p>Cuando ingresás como voluntario, primero aparecen las opciones más cercanas a tu perfil.</p></div><Button variant="outline" onClick={() => setShowMap((value) => !value)}><Map /> {showMap ? "Ver listado" : "Ver mapa"}</Button></div>
    <div className="feed-search"><Search /><Input data-tour-action="opportunity-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar oportunidades, organizaciones o temáticas" /></div>
    <div className="feed-layout document-feed"><aside className="filter-panel"><div className="aside-title"><b>Filtros</b></div><label>Provincia<Select value={province} onValueChange={setProvince}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{provinces.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></label><label>Modalidad<Select value={modality} onValueChange={setModality}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Todas", "Presencial", "Virtual", "Híbrida"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></label></aside>
      <div className="feed-main"><div className="feed-count"><b>{filtered.length} oportunidades</b><span>{user?.role === "volunteer" ? "las más afines aparecen primero" : "disponibles"}</span></div>{showMap ? <OpportunityMap opportunities={filtered} selectedId={null} onSelect={(id) => { const item = filtered.find((candidate) => candidate.id === id); if (item) onOpen(item); }} /> : filtered.map((item) => <OpportunityCard key={item.id} item={item} personalized={user?.role === "volunteer"} onOpen={() => onOpen(item)} />)}</div>
    </div>
  </section>;
}

function OpportunityCard({ item, personalized, onOpen }: { item: Opportunity; personalized?: boolean; onOpen: () => void }) {
  return <article className="feed-opportunity-card"><div className="opportunity-photo" style={{ backgroundImage: `url(${item.imageUrl})` }}><Badge>{readableText(item.category)}</Badge>{item.simulated && <SimulatedSeal />}</div><div className="opportunity-copy">{personalized && <div className="compatibility-row"><strong>{item.compatibility ?? 0}% coincide con vos</strong><span><i style={{ width: `${item.compatibility ?? 0}%` }} /></span></div>}<div className="opportunity-heading"><div><h2>{readableText(item.title)}</h2><p>{readableText(item.organization)}</p></div></div><div className="opportunity-info"><span><CalendarDays /> {readableText(item.dateLabel)}</span><span><Clock3 /> {item.time}</span><span><MapPin /> {readableText(item.neighborhood)}</span><span>{item.modality ?? "Presencial"}</span></div><p className="opportunity-description">{readableText(item.description)}</p>{personalized && <p className="recommendation-reason">{item.recommendedBecause}</p>}<footer><span><Users /> {item.availableSpots} lugares disponibles</span><Button size="sm" onClick={onOpen}>Ver detalle</Button></footer></div></article>;
}

function VolunteerPanel({ user, profile, applications, invitations, absenceReports, community, organizations, reviews, opportunities, onInvitations, onProfile, onReview, onExplore, onViewOrganization, canReturnToOrganization = false, onSwitchRole }: { user: SessionUser; profile: VolunteerProfile; applications: Application[]; invitations: Invitation[]; absenceReports: AbsenceReport[]; community: VolunteerProfile[]; organizations: Organization[]; reviews: Review[]; opportunities: Opportunity[]; onInvitations: (items: Invitation[]) => void; onProfile: (profile: VolunteerProfile) => void; onReview: (review: Review) => void; onExplore: () => void; onViewOrganization?: (organization: Organization) => void; canReturnToOrganization?: boolean; onSwitchRole?: () => void }) {
  const [editOpen, setEditOpen] = useState(false);
  const [reviewApplication, setReviewApplication] = useState<Application | null>(null);
  async function respondToInvitation(item: Invitation, status: "accepted" | "rejected") {
    try {
      const next = user.isDemo ? { ...item, status } : await updateInvitationStatus(user, item, status);
      onInvitations(invitations.map((current) => current.id === next.id ? next : current));
      toast.success(status === "accepted" ? "Propuesta aceptada y vinculación creada" : "Propuesta rechazada");
    } catch (error) { toast.error("No pudimos responder la propuesta", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); }
  }
  return <Dashboard title={`Hola, ${profile.name}`} description="Acá encontrás oportunidades acordes a lo que te interesa y sabés hacer." icon={<UserRound />} action={<span className="inline-actions">{canReturnToOrganization && onSwitchRole && <Button variant="outline" onClick={onSwitchRole}><Building2 /> Volver a organización</Button>}<Button data-tour-action="volunteer-edit-profile" onClick={() => setEditOpen(true)}><Pencil /> Editar perfil</Button></span>}>
    <div className="stats-grid"><Stat label="Experiencias" value={profile.completedExperiences} detail="completadas" /><Stat label="Intereses" value={profile.interests.length} detail="registrados" /><Stat label="Habilidades" value={(profile.declaredSkills ?? []).length} detail="declaradas" /><Stat label="Verificadas" value={Object.keys(profile.verifiedSkills ?? {}).length} detail="por organizaciones" /></div>
    <div className="dashboard-grid"><section className="panel-card wide-panel" data-tour="volunteer-recommendations"><div className="panel-heading"><div><span>Opciones para vos</span><h2>Las que más coinciden con vos</h2></div><Button variant="outline" onClick={onExplore}>Ver todas</Button></div><div className="mini-opportunity-grid">{opportunities.slice(0, 3).map((item) => <div key={item.id}><b>{item.compatibility ?? 0}%</b>{item.simulated && <SimulatedSeal />}<h3>{item.title}</h3><p>{item.recommendedBecause}</p></div>)}</div></section>
      <section className="panel-card" data-tour="volunteer-profile"><div className="panel-heading"><div><span>Perfil</span><h2>Lo que te interesa</h2></div></div><Info label="Ubicación" value={profile.location} /><Info label="Intereses" value={profile.interests.join(", ") || "Sin completar"} /><Info label="Habilidades" value={(profile.declaredSkills ?? []).join(", ") || "Sin completar"} /><Info label="Disponibilidad" value={(profile.availability ?? []).join(", ") || "Sin completar"} />{Object.values(profile.socialLinks ?? {}).some(Boolean) && <div className="social-links">{profile.socialLinks?.instagram && <a href={profile.socialLinks.instagram} target="_blank" rel="noreferrer"><Globe2 /> Instagram</a>}{profile.socialLinks?.linkedin && <a href={profile.socialLinks.linkedin} target="_blank" rel="noreferrer"><Globe2 /> LinkedIn</a>}{profile.socialLinks?.other && <a href={profile.socialLinks.other} target="_blank" rel="noreferrer"><Globe2 /> Otra red</a>}</div>}</section>
      <section className="panel-card" data-tour="volunteer-invitations"><div className="panel-heading"><div><span>Propuestas</span><h2>Invitaciones de organizaciones</h2></div></div><div className="timeline-list">{invitations.map((item) => <div key={item.id}><span className="timeline-icon"><Building2 /></span><div><b>{item.opportunityTitle}</b><p>{item.organizationName} · {item.absentAt ? "Ausencia informada, pendiente de revisión" : item.message}</p>{item.status === "accepted" && item.organizationContact && <small>Contacto habilitado: <a href={`mailto:${item.organizationContact}`}>{item.organizationContact}</a></small>}</div>{item.status === "pending" ? <span className="inline-actions"><Button size="sm" onClick={() => void respondToInvitation(item, "accepted")}>Aceptar</Button><Button size="sm" variant="outline" onClick={() => void respondToInvitation(item, "rejected")}>Rechazar</Button></span> : <Badge variant="secondary">{item.absentAt ? "En revisión" : item.status === "accepted" ? "Aceptada" : "Rechazada"}</Badge>}</div>)}{!invitations.length && <p className="panel-note">Las propuestas directas aparecerán acá.</p>}</div></section>
      <section className="panel-card" data-tour="volunteer-applications"><div className="panel-heading"><div><span>Solicitudes</span><h2>Estado de tus postulaciones</h2></div></div><p className="panel-note">Si no podés asistir a una participación confirmada, contactá a la organización con al menos 6 horas de anticipación.</p><div className="timeline-list">{applications.filter((item) => item.userId === user.uid || user.isDemo).map((item) => { const reviewed = reviews.some((review) => review.applicationId === item.id); const contact = organizations.find((org) => org.id === item.organizationId)?.contact; return <div key={item.id}><span className="timeline-icon"><Check /></span><div><b>{item.opportunityTitle}</b><p>{item.completedAt ? "Experiencia completada" : item.absentAt ? "Ausencia informada, pendiente de revisión" : item.status === "accepted" ? "Participación confirmada" : item.status === "rejected" ? "Solicitud rechazada" : "Pendiente de respuesta"}</p>{item.status === "accepted" && contact && <small>Contacto habilitado: <a href={`mailto:${contact}`}>{contact}</a></small>}</div>{item.completedAt ? <Button size="sm" variant="outline" disabled={reviewed} onClick={() => setReviewApplication(item)}>{reviewed ? "Reseñada" : "Escribir reseña"}</Button> : <Badge variant="secondary">{item.absentAt ? "En revisión" : item.status}</Badge>}</div>; })}</div></section>
      <section className="panel-card wide-panel"><div className="panel-heading"><div><span>Trayectoria</span><h2>Habilidades verificadas</h2></div></div><p className="panel-note">Una habilidad aparece cuando una organización la registra en una experiencia completada.</p><div className="verified-skill-list">{Object.keys(profile.verifiedSkills ?? {}).filter((skill) => (profile.verifiedSkills?.[skill] ?? 0) > 0).map((skill) => <span key={skill}><Check /> {skill}</span>)}{!Object.values(profile.verifiedSkills ?? {}).some((count) => count > 0) && <p className="featured-empty">Todavía no hay habilidades verificadas.</p>}</div></section>
      <section className="panel-card wide-panel" data-tour="volunteer-experiences"><div className="panel-heading"><div><span>Trayectoria</span><h2>Experiencias verificadas</h2></div></div><div className="timeline-list">{(profile.experiences ?? []).length ? profile.experiences!.map((item) => <div key={`${item.opportunityId}-${item.completedAt}`}><span className="timeline-icon"><Check /></span><div><b>{item.opportunityTitle}</b><p>{item.organization} · {item.tasks.join(", ")}</p><small>Habilidades observadas: {item.skills.join(", ")}</small></div></div>) : <p className="panel-note">Las experiencias completadas aparecerán acá.</p>}</div></section>
      <section className="panel-card wide-panel"><div className="panel-heading"><div><span>Asistencia</span><h2>Historial de ausencias</h2></div></div><div className="timeline-list">{absenceReports.map((item) => <div key={item.id}><span className="timeline-icon"><Clock3 /></span><div><b>{item.opportunityTitle}</b><p>{item.organizationName} · {item.status === "confirmed" ? "Ausencia confirmada" : item.status === "dismissed" ? "Reporte descartado" : "Pendiente de revisión"}</p>{item.reviewReason && <small>{item.reviewReason}</small>}</div><Badge variant="secondary">{item.status === "confirmed" ? "Confirmada" : item.status === "dismissed" ? "Descartada" : "En revisión"}</Badge></div>)}{!absenceReports.length && <p className="panel-note">No tenés ausencias registradas.</p>}</div></section>
      <section className="panel-card wide-panel"><div className="panel-heading"><div><span>Organizaciones</span><h2>Conocé quiénes publican oportunidades</h2></div></div><div className="organization-card-grid">{organizations.map((item) => <article key={item.id}><div className="organization-card-photo" style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined}>{!item.imageUrl && <Building2 />}</div><div><span>{(item.areas ?? []).slice(0, 2).join(" · ") || "Organización social"}</span><h3>{item.name}</h3><p>{item.description}</p><small><MapPin /> {item.location ?? item.province}</small></div><Button variant="outline" size="sm" onClick={() => onViewOrganization?.(item)}>Ver perfil</Button></article>)}{!organizations.length && <p className="panel-note">Todavía no hay organizaciones visibles.</p>}</div></section>
      <section className="panel-card wide-panel"><div className="panel-heading"><div><span>Comunidad</span><h2>Otros voluntarios</h2></div></div><p className="panel-note">Por privacidad, los apellidos aparecen abreviados. Las redes solo se muestran si cada persona decidió compartirlas.</p><div className="volunteer-card-grid">{community.filter((item) => item.id !== profile.id).map((item) => <article key={item.id}><span className="profile-avatar">{item.initials}</span><div><b>{privateVolunteerName(item.name)}</b><p>{item.location}</p><small>{item.bio || (item.declaredSkills ?? []).slice(0, 3).join(" · ")}</small>{Object.values(item.socialLinks ?? {}).some(Boolean) && <span className="social-links">{item.socialLinks?.instagram && <a href={externalSocialUrl(item.socialLinks.instagram)} target="_blank" rel="noreferrer">{instagramLabel(item.socialLinks.instagram)}</a>}{item.socialLinks?.linkedin && <a href={externalSocialUrl(item.socialLinks.linkedin)} target="_blank" rel="noreferrer">LinkedIn</a>}{item.socialLinks?.other && <a href={externalSocialUrl(item.socialLinks.other)} target="_blank" rel="noreferrer">Sitio</a>}</span>}</div></article>)}{community.filter((item) => item.id !== profile.id).length === 0 && <p className="panel-note">Todavía no hay otros perfiles visibles.</p>}</div></section>
    </div><VolunteerProfileDialog user={user} profile={profile} open={editOpen} onOpenChange={setEditOpen} onSaved={onProfile} /><ReviewDialog user={user} application={reviewApplication} organizationName={opportunities.find((item) => item.id === reviewApplication?.opportunityId)?.organization ?? "Organización participante"} open={Boolean(reviewApplication)} onOpenChange={(nextOpen) => !nextOpen && setReviewApplication(null)} onSaved={onReview} />
  </Dashboard>;
}

function OrganizationPanel({ user, organization, opportunities, applications, invitations, volunteers, onOrganization, onOpportunities, onApplications, onInvitations, onProfile, onFirstLink, onSwitchRole }: { user: SessionUser; organization: Organization; opportunities: Opportunity[]; applications: Application[]; invitations: Invitation[]; volunteers: VolunteerProfile[]; onOrganization: (organization: Organization) => void; onOpportunities: (items: Opportunity[]) => void; onApplications: (items: Application[]) => void; onInvitations: (items: Invitation[]) => void; onProfile: (profile: VolunteerProfile) => void; onFirstLink: () => void; onSwitchRole?: () => void }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [opportunityOpen, setOpportunityOpen] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [experience, setExperience] = useState<Application | null>(null);
  const [absence, setAbsence] = useState<Application | null>(null);
  const [invitedVolunteer, setInvitedVolunteer] = useState<VolunteerProfile | null>(null);
  const own = opportunities.filter((item) => item.organizationId === organization.id || (user.isDemo && item.organizationId === "fundemos"));
  const requests = applications.filter((item) => own.some((opportunity) => opportunity.id === item.opportunityId) || user.isDemo);
  const activeRequests = requests.filter((item) =>
    (item.status === "pending" || item.status === "accepted") && !item.completedAt && !item.absentAt,
  );
  // Para la organización se usa el mismo cálculo que ordena oportunidades al voluntario,
  // pero se toma el mejor resultado de cada perfil frente a sus publicaciones.
  const rankedVolunteers = volunteers
    .map((volunteer) => {
      const bestOpportunity = recommendOpportunities(own, volunteer)[0];
      return { volunteer, bestOpportunity, compatibility: bestOpportunity?.compatibility ?? 0 };
    })
    .sort((left, right) => right.compatibility - left.compatibility || left.volunteer.name.localeCompare(right.volunteer.name, "es"));
  const highCompatibilityVolunteers = rankedVolunteers.filter((item) => item.compatibility >= HIGH_COMPATIBILITY_MIN);
  const suggestedVolunteers = !own.length ? [] : highCompatibilityVolunteers.length ? highCompatibilityVolunteers : rankedVolunteers.slice(0, 5);
  const volunteerById = new globalThis.Map(volunteers.map((item) => [item.id, item]));
  const opportunityById = new globalThis.Map(own.map((item) => [item.id, item]));
  const rankedInvitations = invitations
    .map((invitation) => {
      const volunteer = volunteerById.get(invitation.userId);
      const opportunity = opportunityById.get(invitation.opportunityId);
      const compatibility = volunteer && opportunity ? calculateCompatibility(volunteer, opportunity).score : 0;
      return { invitation, compatibility };
    })
    .sort((left, right) => right.compatibility - left.compatibility);
  async function decide(item: Application, status: "accepted" | "rejected") {
    try {
      if (!user.isDemo) await updateApplicationStatus(item, status);
      onApplications(applications.map((current) => current.id === item.id ? { ...current, status } : current));
      if (status === "accepted") onFirstLink();
      toast.success(status === "accepted" ? "Participación confirmada" : "Solicitud rechazada");
    } catch (error) { toast.error("No pudimos actualizar la solicitud", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); }
  }
  function invitationAsApplication(item: Invitation): Application {
    return {
      id: item.id, opportunityId: item.opportunityId, opportunityTitle: item.opportunityTitle,
      organizationId: item.organizationId, userId: item.userId, userName: item.userName,
      userEmail: "", message: item.message, status: "accepted", createdAt: item.createdAt,
      completedAt: item.completedAt, absentAt: item.absentAt, source: "invitation", matchId: `invitation_${item.id}`,
    };
  }
  const canPublish = user.isDemo || organization.status === "verified";
  return <Dashboard title={organization.name} description="Gestioná el perfil, las oportunidades y las participaciones." icon={<Building2 />} action={<span className="inline-actions">{onSwitchRole && <Button variant="outline" onClick={onSwitchRole}><UserRound /> Cambiar a voluntario</Button>}<Button data-tour-action="organization-new-opportunity" disabled={!canPublish} title={!canPublish ? "Administración debe validar la organización" : undefined} onClick={() => { setEditing(null); setOpportunityOpen(true); }}><Plus /> Nueva oportunidad</Button></span>}>
    <div className="stats-grid"><Stat label="Oportunidades" value={own.length} detail="publicadas" /><Stat label="Interesados" value={requests.filter((item) => item.status === "pending").length} detail="pendientes" /><Stat label="Confirmados" value={requests.filter((item) => item.status === "accepted" && !item.completedAt).length} detail="participaciones" /><Stat label="Completadas" value={requests.filter((item) => item.completedAt).length} detail="experiencias" /></div>
    <div className="dashboard-grid"><section className="panel-card wide-panel" data-tour="organization-profile"><div className="panel-heading"><div><span>Perfil</span><h2>Información de la organización</h2></div><Button data-tour-action="organization-edit-profile" variant="outline" onClick={() => setProfileOpen(true)}><Pencil /> Editar</Button></div>{!canPublish && <p className="match-note"><b>Validación pendiente.</b> Podés completar el perfil, pero las publicaciones se habilitan cuando administración revise los datos.</p>}<div className="organization-profile-summary"><div className="organization-summary-photo" style={organization.imageUrl ? { backgroundImage: `url(${organization.imageUrl})` } : undefined}>{!organization.imageUrl && <Building2 />}</div><div><p>{organization.description}</p><Info label="Áreas de trabajo" value={(organization.areas ?? []).join(" · ") || "Todavía no informadas"} /><Info label="Ubicación" value={organization.location ?? organization.province} /><Info label="Contacto" value={organization.contact ?? organization.email} /></div></div></section>
      <CollapsibleListSection data-tour="organization-opportunities" eyebrow="Publicaciones" title="Oportunidades" items={own} getKey={(item) => item.id} searchText={(item) => `${item.title} ${item.category} ${item.modality} ${item.province}`} searchPlaceholder="Buscar oportunidad" emptyText="Todavía no publicaste oportunidades." renderItem={(item) => <><span className="timeline-icon"><CalendarDays /></span><div><b>{item.title}</b><p>{item.modality ?? "Presencial"} · {(item.availability ?? []).join(", ")}</p></div><Button size="sm" variant="outline" onClick={() => { setEditing(item); setOpportunityOpen(true); }}>Editar</Button></>} />
      <CollapsibleListSection data-tour="organization-applications" eyebrow="Vinculación" title="Solicitudes de participación" items={activeRequests} getKey={(item) => item.id} searchText={(item) => `${item.userName} ${item.userEmail ?? ""} ${item.opportunityTitle} ${item.status}`} searchPlaceholder="Buscar persona o oportunidad" emptyText="No hay solicitudes activas. Las participaciones completadas permanecen registradas en el historial." defaultOpen={activeRequests.some((item) => item.status === "pending")} renderItem={(item) => <><span className="profile-avatar">{item.userName.charAt(0)}</span><div><b>{item.userName}</b><p>{item.opportunityTitle} · {participationStatusLabel(item.status)}</p>{item.status === "accepted" && item.userEmail && <small>Contacto habilitado: <a href={`mailto:${item.userEmail}`}>{item.userEmail}</a></small>}</div>{item.status === "pending" ? <span className="inline-actions"><Button size="sm" onClick={() => void decide(item, "accepted")}>Aceptar</Button><Button size="sm" variant="outline" onClick={() => void decide(item, "rejected")}>Rechazar</Button></span> : <span className="inline-actions"><Button size="sm" onClick={() => setExperience(item)}>Marcar realizada</Button><Button size="sm" variant="outline" onClick={() => setAbsence(item)}>Informar ausencia</Button></span>}</>} />
      <CollapsibleListSection data-tour="organization-volunteers" eyebrow="Descubrir personas" title="Voluntarios disponibles" items={suggestedVolunteers} getKey={(item) => item.volunteer.id} searchText={(item) => `${item.volunteer.name} ${item.volunteer.location} ${(item.volunteer.declaredSkills ?? []).join(" ")} ${item.volunteer.bio} ${item.bestOpportunity?.title ?? ""}`} searchPlaceholder="Buscar voluntario o habilidad" emptyText={own.length ? "Todavía no hay perfiles compatibles con estas oportunidades." : "Publicá una oportunidad para recibir sugerencias de voluntarios."} defaultOpen={false} renderItem={({ volunteer, bestOpportunity, compatibility }) => { const pending = invitations.some((item) => item.userId === volunteer.id && item.status === "pending"); return <><span className="profile-avatar">{volunteer.initials}</span><div><b>{volunteer.name}</b><p>{volunteer.location} · {compatibility}% de coincidencia</p><small>{bestOpportunity ? `Mejor opción: ${bestOpportunity.title}` : "Perfil en formación"}</small></div><Button size="sm" variant="outline" disabled={pending || !own.length} onClick={() => setInvitedVolunteer(volunteer)}>{pending ? "Invitación enviada" : "Invitar"}</Button></>; }} />
      <CollapsibleListSection data-tour="organization-invitations" eyebrow="Propuestas directas" title="Estado de invitaciones" items={rankedInvitations} getKey={(item) => item.invitation.id} searchText={(item) => `${item.invitation.userName} ${item.invitation.opportunityTitle} ${item.invitation.status}`} searchPlaceholder="Buscar invitación" emptyText="Las invitaciones enviadas aparecerán acá." defaultOpen={false} renderItem={({ invitation: item, compatibility }) => <><span className="profile-avatar">{item.userName.charAt(0)}</span><div><b>{item.userName}</b><p>{item.opportunityTitle} · {compatibility}% de coincidencia · {item.completedAt ? "experiencia completada" : item.absentAt ? "ausencia en revisión" : item.status === "accepted" ? "invitación aceptada" : item.status === "rejected" ? "invitación rechazada" : "esperando respuesta"}</p></div>{item.status === "accepted" && !item.completedAt && !item.absentAt ? <span className="inline-actions"><Button size="sm" onClick={() => setExperience(invitationAsApplication(item))}>Marcar realizada</Button><Button size="sm" variant="outline" onClick={() => setAbsence(invitationAsApplication(item))}>Informar ausencia</Button></span> : <Badge variant="secondary">{item.completedAt ? "Completada" : item.absentAt ? "En revisión" : participationStatusLabel(item.status)}</Badge>}</>} />
    </div>
    <OrganizationProfileDialog user={user} organization={organization} open={profileOpen} onOpenChange={setProfileOpen} onSaved={onOrganization} />
    <OpportunityEditor key={`${editing?.id ?? "new"}-${opportunityOpen ? "open" : "closed"}`} user={user} organization={organization} opportunity={editing} open={opportunityOpen} onOpenChange={setOpportunityOpen} onSaved={(next) => onOpportunities(editing ? opportunities.map((item) => item.id === next.id ? next : item) : [next, ...opportunities])} />
    <InvitationDialog key={invitedVolunteer?.id ?? "closed"} user={user} organization={organization} volunteer={invitedVolunteer} opportunities={own} open={Boolean(invitedVolunteer)} onOpenChange={(open) => !open && setInvitedVolunteer(null)} onSaved={(next) => onInvitations([next, ...invitations.filter((item) => item.id !== next.id)])} />
    <ExperienceDialog user={user} organization={organization} application={experience} open={Boolean(experience)} onOpenChange={(open) => !open && setExperience(null)} onCompleted={(next, skills, tasks) => { if (next.source === "invitation") onInvitations(invitations.map((item) => item.id === next.id ? { ...item, completedAt: next.completedAt } : item)); else onApplications(applications.map((item) => item.id === next.id ? next : item)); onProfile({ ...DEMO_VOLUNTEERS[0], completedExperiences: DEMO_VOLUNTEERS[0].completedExperiences + 1, verifiedSkills: registerVerifiedSkills(DEMO_VOLUNTEERS[0].verifiedSkills ?? {}, skills), experiences: [...(DEMO_VOLUNTEERS[0].experiences ?? []), { opportunityId: next.opportunityId, opportunityTitle: next.opportunityTitle, organization: organization.name, tasks, skills, completedAt: new Date().toISOString() }] }); }} />
    <AbsenceDialog user={user} organization={organization} application={absence} open={Boolean(absence)} onOpenChange={(open) => !open && setAbsence(null)} onSaved={(next) => { if (next.source === "invitation") onInvitations(invitations.map((item) => item.id === next.id ? { ...item, absentAt: next.absentAt } : item)); else onApplications(applications.map((item) => item.id === next.id ? next : item)); }} />
  </Dashboard>;
}

function CollapsibleListSection<T>({ eyebrow, title, items, getKey, searchText, searchPlaceholder, emptyText, renderItem, defaultOpen = true, "data-tour": dataTour }: {
  eyebrow: string;
  title: string;
  items: T[];
  getKey: (item: T) => string;
  searchText: (item: T) => string;
  searchPlaceholder: string;
  emptyText: string;
  renderItem: (item: T) => ReactNode;
  defaultOpen?: boolean;
  "data-tour"?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const visibleItems = normalizedQuery
    ? items.filter((item) => searchText(item).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(normalizedQuery))
    : items;
  return <section className="panel-card wide-panel admin-section" data-tour={dataTour}>
    <div className="panel-heading admin-section-heading"><div><span>{eyebrow}</span><h2>{title} <Badge variant="secondary">{items.length}</Badge></h2></div><Button type="button" size="sm" variant="ghost" className="admin-collapse" aria-expanded={open} onClick={() => setOpen((current) => !current)}><ChevronRight className={open ? "open" : ""} />{open ? "Ocultar" : "Mostrar"}</Button></div>
    {open && <div className="admin-section-content"><label className="admin-list-search"><Search /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} /></label><div className="admin-list">{visibleItems.map((item) => <div key={getKey(item)}>{renderItem(item)}</div>)}{!visibleItems.length && <p className="panel-note">{query ? "No hay resultados para esa búsqueda." : emptyText}</p>}</div></div>}
  </section>;
}

function AdminPanel({ user, opportunities, reviews }: { user: SessionUser; opportunities: Opportunity[]; reviews: Review[] }) {
  const demoUsers = Object.values(DEMO_USERS) as PlatformUser[];
  const [managedUsers, setManagedUsers] = useState<PlatformUser[]>(demoUsers);
  const [managedOpportunities, setManagedOpportunities] = useState<Opportunity[]>(opportunities);
  const [managedOrganizations, setManagedOrganizations] = useState<Organization[]>([DEMO_ORGANIZATION]);
  const [managedReviews, setManagedReviews] = useState<Review[]>(reviews);
  const [reviewReports, setReviewReports] = useState<ReviewReport[]>(DEMO_REVIEW_REPORTS);
  const [reviewPhotos, setReviewPhotos] = useState<ReviewPhoto[]>([]);
  const [feedback, setFeedback] = useState<ExperienceFeedback[]>([]);
  const [absenceReports, setAbsenceReports] = useState<AbsenceReport[]>([]);
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReviewReport | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<ReviewPhoto | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<ExperienceFeedback | null>(null);
  const [selectedAbsence, setSelectedAbsence] = useState<AbsenceReport | null>(null);

  useEffect(() => {
    if (user.isDemo) return;
    const fail = (error: Error) => toast.error("No se pudo cargar administración", { description: error.message });
    const stops = [
      observeAdminUsers(setManagedUsers, fail),
      observeAdminOpportunities(setManagedOpportunities, fail),
      observeAdminOrganizations(setManagedOrganizations, fail),
      observeAdminReviews(setManagedReviews, fail),
      observeAdminReviewReports(setReviewReports, fail),
      observeAdminReviewPhotos(setReviewPhotos, fail),
      observeAdminFeedback(setFeedback, fail),
      observeAdminAbsenceReports(setAbsenceReports, fail),
    ];
    return () => stops.forEach((stop) => stop());
  }, [user.isDemo]);

  const pendingOrganizations = managedOrganizations.filter((item) => item.status === "pending");
  const pendingReviewReports = reviewReports.filter((item) => item.status === "pending");
  const pendingReviewPhotos = reviewPhotos.filter((item) => item.status === "pending");
  const pendingFeedback = feedback.filter((item) => item.status === "pending_review");
  const pendingAbsences = absenceReports.filter((item) => item.status === "pending_review");

  return <Dashboard title="Administración" description="Supervisión general, moderación y corrección de la plataforma." icon={<Shield />} action={<Badge variant="secondary">{user.isDemo ? "Modo demostración" : "Plataforma activa"}</Badge>}>
    <div className="stats-grid"><Stat label="Usuarios" value={managedUsers.length} detail="cuentas registradas" /><Stat label="Organizaciones" value={managedOrganizations.filter((item) => item.status === "pending").length} detail="pendientes de validar" /><Stat label="Oportunidades" value={managedOpportunities.length} detail="totales" /><Stat label="Por revisar" value={reviewReports.filter((item) => item.status === "pending").length + reviewPhotos.filter((item) => item.status === "pending").length + feedback.filter((item) => item.status === "pending_review").length + absenceReports.filter((item) => item.status === "pending_review").length} detail="casos pendientes" /></div>
    <div className="dashboard-grid admin-grid">
      <CollapsibleListSection eyebrow="Validación" title="Organizaciones pendientes" items={pendingOrganizations} getKey={(item) => item.id} searchText={(item) => `${item.name} ${item.email} ${item.province} ${(item.areas ?? []).join(" ")}`} searchPlaceholder="Buscar organización" emptyText="No hay organizaciones pendientes de validar." renderItem={(item) => <><span className="admin-icon amber"><Building2 /></span><div><b>{item.name}</b><p>{item.email} · {item.province} · pendiente</p>{Boolean(item.areas?.length) && <small>Áreas: {item.areas!.join(" · ")}</small>}{item.moderationReason && <small>Último motivo: {item.moderationReason}</small>}</div><Button size="sm" variant="outline" onClick={() => setSelectedOrganization(item)}><ShieldCheck /> Revisar</Button></>} />
      <CollapsibleListSection eyebrow="Control de usuarios" title="Perfiles, roles y contacto" items={managedUsers} getKey={(item) => item.uid} searchText={(item) => `${item.displayName} ${item.email} ${item.role} ${item.status}`} searchPlaceholder="Buscar usuario o correo" emptyText="No se encontraron usuarios." defaultOpen={false} renderItem={(item) => <><span className="admin-icon green">{item.role === "organization" ? <Building2 /> : item.role === "admin" ? <Shield /> : <UserRound />}</span><div><b>{item.displayName}</b><p>{item.email} · {roleLabel(item.role)} · {item.status === "suspended" ? "suspendido" : "activo"}</p>{item.suspensionReason && <small>Motivo: {item.suspensionReason}</small>}</div><span className="inline-actions"><Badge variant={item.status === "suspended" ? "destructive" : "secondary"}>{item.status === "suspended" ? "Suspendido" : "Activo"}</Badge><Button size="sm" variant="outline" onClick={() => setSelectedUser(item)} disabled={item.uid === user.uid}><Settings2 /> Gestionar</Button></span></>} />
      <CollapsibleListSection eyebrow="Moderación" title="Oportunidades" items={managedOpportunities} getKey={(item) => item.id} searchText={(item) => `${item.title} ${item.organization} ${item.province} ${item.category} ${item.status}`} searchPlaceholder="Buscar oportunidad" emptyText="No se encontraron oportunidades." defaultOpen={false} renderItem={(item) => <><span className={`admin-icon ${item.status === "published" ? "green" : "amber"}`}>{item.status === "published" ? <ShieldCheck /> : <Ban />}</span><div><b>{item.title}</b><p>{item.organization} · {item.province} · {item.status === "published" ? "visible" : "oculta"}</p>{item.moderationReason && <small>Último motivo: {item.moderationReason}</small>}</div><Button size="sm" variant="outline" onClick={() => setSelectedOpportunity(item)}><Pencil /> Corregir</Button></>} />
      <CollapsibleListSection eyebrow="Reseñas" title="Denuncias pendientes" items={pendingReviewReports} getKey={(item) => item.id} searchText={(item) => { const review = managedReviews.find((candidate) => candidate.id === item.reviewId); return `${item.reason} ${review?.opportunityTitle ?? ""} ${review?.authorName ?? ""}`; }} searchPlaceholder="Buscar denuncia" emptyText="No hay denuncias pendientes." defaultOpen={pendingReviewReports.length > 0} renderItem={(report) => { const review = managedReviews.find((item) => item.id === report.reviewId); return <><span className="admin-icon amber"><Ban /></span><div><b>{review?.opportunityTitle ?? "Reseña"}</b><p>{report.reason}</p><small>{review?.authorName} · {review?.rating ?? 0} estrellas</small></div><Button size="sm" variant="outline" onClick={() => setSelectedReport(report)}>Revisar</Button></>; }} />
      <CollapsibleListSection eyebrow="Fotografías" title="Aprobación previa" items={pendingReviewPhotos} getKey={(item) => item.id} searchText={(item) => { const review = managedReviews.find((candidate) => candidate.id === item.reviewId); return `${review?.opportunityTitle ?? ""} ${review?.authorName ?? ""}`; }} searchPlaceholder="Buscar fotografía" emptyText="No hay fotografías pendientes." defaultOpen={pendingReviewPhotos.length > 0} renderItem={(photo) => { const review = managedReviews.find((item) => item.id === photo.reviewId); return <><Image className="admin-review-photo" src={photo.imageDataUrl} alt="Fotografía pendiente" width={88} height={64} unoptimized /><div><b>{review?.opportunityTitle ?? "Foto de reseña"}</b><p>{review?.authorName ?? "Persona voluntaria"}</p><small>La reseña ya está publicada; esta imagen aún no.</small></div><Button size="sm" variant="outline" onClick={() => setSelectedPhoto(photo)}>Revisar</Button></>; }} />
      <CollapsibleListSection eyebrow="Devoluciones" title="Aspectos a mejorar pendientes" items={pendingFeedback} getKey={(item) => item.id} searchText={(item) => `${item.volunteerName} ${item.opportunityTitle} ${item.organizationName} ${item.submittedByEmail} ${item.details}`} searchPlaceholder="Buscar devolución" emptyText="No hay devoluciones negativas pendientes." defaultOpen={pendingFeedback.length > 0} renderItem={(item) => <><span className="admin-icon amber"><Shield /></span><div><b>{item.volunteerName} · {item.opportunityTitle}</b><p>{item.details}</p><small>{item.organizationName} · {item.submittedByEmail}</small></div><Button size="sm" variant="outline" onClick={() => setSelectedFeedback(item)}>Corroborar</Button></>} />
      <CollapsibleListSection eyebrow="Asistencia" title="Ausencias por corroborar" items={pendingAbsences} getKey={(item) => item.id} searchText={(item) => `${item.volunteerName} ${item.opportunityTitle} ${item.organizationName} ${item.reportedByEmail} ${item.reason}`} searchPlaceholder="Buscar ausencia" emptyText="No hay ausencias pendientes." defaultOpen={pendingAbsences.length > 0} renderItem={(item) => <><span className="admin-icon amber"><Clock3 /></span><div><b>{item.volunteerName} · {item.opportunityTitle}</b><p>{item.reason}</p><small>{item.organizationName} · informó {item.reportedByEmail}</small></div><Button size="sm" variant="outline" onClick={() => setSelectedAbsence(item)}>Revisar</Button></>} />
      <section className="panel-card wide-panel"><div className="panel-heading"><div><span>Historial</span><h2>Registro de acciones administrativas</h2></div></div><p className="panel-note">Las decisiones quedan registradas con la persona responsable, el motivo y la fecha. Las oportunidades se ocultan y las cuentas se suspenden por un plazo definido, sin borrar su información.</p></section>
    </div>
    <AdminUserDialog key={selectedUser?.uid ?? "no-user"} actor={user} target={selectedUser} open={Boolean(selectedUser)} onOpenChange={(open) => !open && setSelectedUser(null)} onSaved={(next) => setManagedUsers((items) => items.map((item) => item.uid === next.uid ? next : item))} />
    <AdminOpportunityDialog key={selectedOpportunity?.id ?? "no-opportunity"} actor={user} target={selectedOpportunity} open={Boolean(selectedOpportunity)} onOpenChange={(open) => !open && setSelectedOpportunity(null)} onSaved={(next) => setManagedOpportunities((items) => items.map((item) => item.id === next.id ? next : item))} />
    <AdminOrganizationDialog key={selectedOrganization?.id ?? "no-organization"} actor={user} target={selectedOrganization} open={Boolean(selectedOrganization)} onOpenChange={(open) => !open && setSelectedOrganization(null)} onSaved={(next) => setManagedOrganizations((items) => items.map((item) => item.id === next.id ? next : item))} />
    <AdminReviewDialog actor={user} report={selectedReport} review={managedReviews.find((item) => item.id === selectedReport?.reviewId) ?? null} open={Boolean(selectedReport)} onOpenChange={(open) => !open && setSelectedReport(null)} onSaved={(nextReview, nextReport) => { setManagedReviews((items) => items.map((item) => item.id === nextReview.id ? nextReview : item)); setReviewReports((items) => items.map((item) => item.id === nextReport.id ? nextReport : item)); }} />
    <AdminReviewPhotoDialog actor={user} photo={selectedPhoto} review={managedReviews.find((item) => item.id === selectedPhoto?.reviewId) ?? null} open={Boolean(selectedPhoto)} onOpenChange={(open) => !open && setSelectedPhoto(null)} onSaved={(next) => setReviewPhotos((items) => items.map((item) => item.id === next.id ? next : item))} />
    <AdminFeedbackDialog actor={user} feedback={selectedFeedback} open={Boolean(selectedFeedback)} onOpenChange={(open) => !open && setSelectedFeedback(null)} onSaved={(next, suspended) => { setFeedback((items) => items.map((item) => item.id === next.id ? next : item)); if (suspended) setManagedUsers((items) => items.map((item) => item.uid === next.volunteerId ? { ...item, status: "suspended", suspensionReason: "Dos devoluciones negativas confirmadas dentro de tres meses" } : item)); }} />
    <AdminAbsenceDialog actor={user} report={selectedAbsence} open={Boolean(selectedAbsence)} onOpenChange={(open) => !open && setSelectedAbsence(null)} onSaved={(next, suspended) => { setAbsenceReports((items) => items.map((item) => item.id === next.id ? next : item)); if (suspended) setManagedUsers((items) => items.map((item) => item.uid === next.volunteerId ? { ...item, status: "suspended", suspensionReason: "Tres ausencias confirmadas" } : item)); }} />
  </Dashboard>;
}

function AdminOrganizationDialog({ actor, target, open, onOpenChange, onSaved }: { actor: SessionUser; target: Organization | null; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (organization: Organization) => void }) {
  const [loading, setLoading] = useState(false);
  if (!target) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = String(form.get("status")) as Organization["status"];
    const reason = String(form.get("reason")).trim();
    if (!reason) return toast.error("Indicá el motivo de la decisión.");
    setLoading(true);
    try {
      const next = actor.isDemo
        ? { ...target!, status, moderationReason: reason, moderatedBy: actor.uid, moderatedAt: new Date().toISOString() }
        : await adminUpdateOrganization(actor, target!, status, reason);
      onSaved(next);
      onOpenChange(false);
      toast.success(status === "verified" ? "Organización validada" : "Estado de la organización actualizado");
    } catch (error) {
      toast.error("No se pudo actualizar", { description: error instanceof Error ? error.message : "Intentá nuevamente." });
    } finally {
      setLoading(false);
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>Validar organización</DialogTitle><DialogDescription>{target.name} · {target.email}</DialogDescription></DialogHeader><div className="panel-note"><b>Datos declarados</b><br />{target.description || "Sin descripción todavía."}<br />{target.location ?? target.province} · Contacto: {target.contact ?? target.email}</div><form className="create-form" onSubmit={submit}><label>Decisión<Select name="status" defaultValue={target.status}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Mantener pendiente</SelectItem><SelectItem value="verified">Validar</SelectItem><SelectItem value="suspended">Suspender</SelectItem></SelectContent></Select></label><label className="full">Motivo<Input name="reason" defaultValue={target.moderationReason ?? "Datos revisados por administración"} required /></label><DialogFooter className="full"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Guardar decisión"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function AdminFeedbackDialog({ actor, feedback, open, onOpenChange, onSaved }: { actor: SessionUser; feedback: ExperienceFeedback | null; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (feedback: ExperienceFeedback, suspended: boolean) => void }) {
  const [loading, setLoading] = useState(false);
  if (!feedback) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = String(form.get("status")) as "approved" | "dismissed";
    const reason = String(form.get("reason")).trim();
    const days = Number(form.get("days")) || 7;
    if (!reason) return toast.error("Registrá cómo corroboraste la devolución.");
    setLoading(true);
    try {
      const result = actor.isDemo
        ? { feedback: { ...feedback!, status, moderationReason: reason, moderatedBy: actor.uid, moderatedAt: new Date().toISOString() }, suspended: false }
        : await adminModerateFeedback(actor, feedback!, status, reason, days);
      onSaved(result.feedback, result.suspended);
      onOpenChange(false);
      toast.success(status === "dismissed" ? "Devolución descartada" : result.suspended ? "Devolución confirmada y suspensión aplicada" : "Devolución confirmada y advertencia enviada");
    } catch (error) {
      toast.error("No se pudo resolver", { description: error instanceof Error ? error.message : "Intentá nuevamente." });
    } finally { setLoading(false); }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>Corroborar devolución</DialogTitle><DialogDescription>{feedback.volunteerName} · {feedback.opportunityTitle}</DialogDescription></DialogHeader><div className="panel-note"><b>Organización:</b> {feedback.organizationName}<br /><b>Correo para corroborar fuera de la app:</b> {feedback.submittedByEmail}<br /><b>Aspecto informado:</b> {feedback.details}</div><form className="create-form" onSubmit={submit}><label>Decisión<Select name="status" defaultValue="approved"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="approved">Confirmar devolución</SelectItem><SelectItem value="dismissed">Descartar</SelectItem></SelectContent></Select></label><label>Días si corresponde suspender<Input name="days" type="number" min="1" max="90" defaultValue="7" /></label><label className="full">Constancia de verificación<Textarea name="reason" minLength={10} maxLength={600} placeholder="Ej.: Se contactó por correo con ambas partes y se corroboraron los hechos." required /></label><p className="panel-note full">La primera devolución confirmada genera una advertencia privada. La segunda dentro de 90 días aplica la suspensión temporal indicada.</p><DialogFooter className="full"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Resolver"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function AdminAbsenceDialog({ actor, report, open, onOpenChange, onSaved }: { actor: SessionUser; report: AbsenceReport | null; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (report: AbsenceReport, suspended: boolean) => void }) {
  const [loading, setLoading] = useState(false);
  if (!report) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = String(form.get("status")) as "confirmed" | "dismissed";
    const reason = String(form.get("reason")).trim();
    const days = Number(form.get("days")) || 7;
    if (reason.length < 10) return toast.error("Dejá constancia de la verificación.");
    setLoading(true);
    try {
      const result = actor.isDemo ? { report: { ...report!, status, reviewedBy: actor.uid, reviewedAt: new Date().toISOString(), reviewReason: reason }, suspended: false } : await adminModerateAbsence(actor, report!, status, reason, days);
      onSaved(result.report, result.suspended); onOpenChange(false);
      toast.success(status === "dismissed" ? "Ausencia descartada" : result.suspended ? "Tercera ausencia confirmada y suspensión aplicada" : "Ausencia confirmada");
    } catch (error) { toast.error("No se pudo resolver", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); }
    finally { setLoading(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>Revisar ausencia</DialogTitle><DialogDescription>{report.volunteerName} · {report.opportunityTitle}</DialogDescription></DialogHeader><div className="panel-note"><b>Informó:</b> {report.organizationName} ({report.reportedByEmail})<br /><b>Motivo:</b> {report.reason}</div><form className="create-form" onSubmit={submit}><label>Decisión<Select name="status" defaultValue="confirmed"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="confirmed">Confirmar ausencia</SelectItem><SelectItem value="dismissed">Descartar reporte</SelectItem></SelectContent></Select></label><label>Días si es la tercera<Input name="days" type="number" min="1" max="90" defaultValue="7" /></label><label className="full">Constancia de revisión<Textarea name="reason" minLength={10} maxLength={600} required /></label><DialogFooter className="full"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Resolver"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function AdminReviewPhotoDialog({ actor, photo, review, open, onOpenChange, onSaved }: { actor: SessionUser; photo: ReviewPhoto | null; review: Review | null; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (photo: ReviewPhoto) => void }) {
  const [loading, setLoading] = useState(false);
  if (!photo) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = String(form.get("status")) as "approved" | "rejected";
    const reason = String(form.get("reason")).trim();
    if (!reason) return toast.error("Indicá el motivo de la decisión.");
    setLoading(true);
    try {
      const next = actor.isDemo ? { ...photo!, status, moderationReason: reason, moderatedBy: actor.uid, moderatedAt: new Date().toISOString() } : await adminModerateReviewPhoto(actor, photo!, status, reason);
      onSaved(next);
      onOpenChange(false);
      toast.success(status === "approved" ? "Fotografía aprobada" : "Fotografía rechazada");
    } catch (error) { toast.error("No pudimos moderar la fotografía", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); }
    finally { setLoading(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>Revisar fotografía</DialogTitle><DialogDescription>{review?.opportunityTitle ?? "Foto adjunta a una reseña"}</DialogDescription></DialogHeader><Image className="review-photo-preview" src={photo.imageDataUrl} alt="Fotografía enviada para moderación" width={760} height={430} unoptimized /><form className="create-form" onSubmit={submit}><label>Decisión<Select name="status" defaultValue="approved"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="approved">Aprobar y publicar</SelectItem><SelectItem value="rejected">Rechazar</SelectItem></SelectContent></Select></label><label>Motivo administrativo<Input name="reason" defaultValue="Imagen revisada por administración" required /></label><DialogFooter className="full"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Confirmar decisión"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function AdminUserDialog({ actor, target, open, onOpenChange, onSaved }: { actor: SessionUser; target: PlatformUser | null; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (user: PlatformUser) => void }) {
  const [loading, setLoading] = useState(false);
  if (!target) return null;
  const current = target;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = String(form.get("status")) as "active" | "suspended";
    const values = { displayName: String(form.get("displayName")).trim(), role: String(form.get("role")) as SessionUser["role"], status, suspensionDays: Number(form.get("days") || 7), reason: String(form.get("reason")).trim() };
    if (!values.displayName || !values.reason) return toast.error("Indicá el nombre y el motivo del cambio.");
    setLoading(true);
    try {
      const next: PlatformUser = actor.isDemo ? { ...current, displayName: values.displayName, role: values.role, status: values.status, suspendedUntil: status === "suspended" ? new Date(Date.now() + values.suspensionDays * 86400000).toISOString() : undefined, suspensionReason: status === "suspended" ? values.reason : undefined } : await adminUpdateUser(actor, current, values);
      onSaved(next);
      onOpenChange(false);
      toast.success(status === "suspended" ? "Cuenta suspendida" : "Cuenta actualizada y activa");
    } catch (error) { toast.error("No se pudo modificar la cuenta", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); }
    finally { setLoading(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>Gestionar cuenta</DialogTitle><DialogDescription>{target.email} · {roleLabel(target.role)}</DialogDescription></DialogHeader><form className="create-form" onSubmit={submit}><label className="full">Nombre visible<Input name="displayName" defaultValue={target.displayName} required /></label><label>Rol<Select name="role" defaultValue={target.role}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="volunteer">Voluntario</SelectItem><SelectItem value="organization">Organización</SelectItem><SelectItem value="admin">Administrador</SelectItem></SelectContent></Select></label><label>Estado<Select name="status" defaultValue={target.status ?? "active"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Activa</SelectItem><SelectItem value="suspended">Suspendida</SelectItem></SelectContent></Select></label><label>Días de suspensión<Input type="number" name="days" min="1" max="365" defaultValue="7" /></label><label>Motivo<Input name="reason" defaultValue={target.suspensionReason ?? "Corrección administrativa"} required /></label><DialogFooter className="full"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Aplicar cambio"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function AdminOpportunityDialog({ actor, target, open, onOpenChange, onSaved }: { actor: SessionUser; target: Opportunity | null; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (opportunity: Opportunity) => void }) {
  const [loading, setLoading] = useState(false);
  if (!target) return null;
  const current = target;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = { title: String(form.get("title")).trim(), description: String(form.get("description")).trim(), status: String(form.get("status")) as OpportunityStatus, reason: String(form.get("reason")).trim() };
    if (!values.title || !values.description || !values.reason) return toast.error("Completá el contenido y el motivo de moderación.");
    setLoading(true);
    try {
      const next: Opportunity = actor.isDemo ? { ...current, title: values.title, description: values.description, status: values.status, moderatedBy: actor.uid, moderatedAt: new Date().toISOString(), moderationReason: values.reason } : await adminUpdateOpportunity(actor, current, values);
      onSaved(next);
      onOpenChange(false);
      toast.success(values.status === "closed" ? "Oportunidad ocultada" : "Oportunidad actualizada");
    } catch (error) { toast.error("No se pudo modificar la oportunidad", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); }
    finally { setLoading(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>Moderar oportunidad</DialogTitle><DialogDescription>{target.organization} · {target.province}</DialogDescription></DialogHeader><form className="create-form" onSubmit={submit}><label className="full">Título<Input name="title" defaultValue={target.title} required /></label><label className="full">Descripción<Textarea name="description" defaultValue={target.description} required /></label><label>Visibilidad<Select name="status" defaultValue={target.status}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="published">Publicada</SelectItem><SelectItem value="closed">Oculta</SelectItem></SelectContent></Select></label><label>Motivo<Input name="reason" defaultValue={target.moderationReason ?? "Revisión administrativa"} required /></label><DialogFooter className="full"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Guardar intervención"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function AdminReviewDialog({ actor, review, report, open, onOpenChange, onSaved }: { actor: SessionUser; review: Review | null; report: ReviewReport | null; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (review: Review, report: ReviewReport) => void }) {
  const [loading, setLoading] = useState(false);
  if (!review || !report) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = String(form.get("status")) as "published" | "hidden";
    const reason = String(form.get("reason")).trim();
    if (!reason) return toast.error("Indicá el motivo de la decisión.");
    setLoading(true);
    try {
      const nextReview = actor.isDemo ? { ...review!, status, moderationReason: reason, moderatedBy: actor.uid, moderatedAt: new Date().toISOString() } : await adminModerateReview(actor, review!, report!, status, reason);
      const nextReport = { ...report!, status: "resolved" as const };
      onSaved(nextReview, nextReport);
      onOpenChange(false);
      toast.success(status === "hidden" ? "Reseña ocultada" : "Reseña mantenida");
    } catch (error) { toast.error("No pudimos moderar la reseña", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); }
    finally { setLoading(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>Revisar denuncia</DialogTitle><DialogDescription>{review.authorName} · {review.rating} estrellas · {review.opportunityTitle}</DialogDescription></DialogHeader><blockquote className="review-moderation-text">“{review.comment}”</blockquote><p className="match-note">Motivo denunciado: {report.reason}</p><form className="create-form" onSubmit={submit}><label>Decisión<Select name="status" defaultValue="published"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="published">Mantener publicada</SelectItem><SelectItem value="hidden">Ocultar reseña</SelectItem></SelectContent></Select></label><label>Motivo administrativo<Input name="reason" defaultValue="Contenido revisado por administración" required /></label><DialogFooter className="full"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Resolver denuncia"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function GuideAssistant({ user, profile, opportunities, promptToken, onOpenOpportunity }: { user: SessionUser | null; profile: VolunteerProfile; opportunities: Opportunity[]; promptToken: number; onOpenOpportunity: (item: Opportunity) => void }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"invite" | "questions" | "result">("invite");
  const [goal, setGoal] = useState("aprender");
  const [cause, setCause] = useState("cualquiera");
  const [format, setFormat] = useState("cualquiera");
  const [aiExplanation, setAiExplanation] = useState("");
  const [semanticSuggestion, setSemanticSuggestion] = useState<Opportunity | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  useEffect(() => {
    if (window.sessionStorage.getItem("via-assistant-seen")) return;
    const timer = window.setTimeout(() => {
      setOpen(true);
      window.sessionStorage.setItem("via-assistant-seen", "true");
    }, 10000);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!promptToken) return;
    const timer = window.setTimeout(() => { setStage("invite"); setOpen(true); }, 0);
    return () => window.clearTimeout(timer);
  }, [promptToken]);

  const normalizedCause = cause.toLocaleLowerCase("es");
  const matchesFormat = (item: Opportunity) => format === "cualquiera" || item.modality?.toLocaleLowerCase("es") === format;
  const matchesCause = (item: Opportunity) => cause === "cualquiera" || `${item.category} ${item.title}`.toLocaleLowerCase("es").includes(normalizedCause);
  const suggested = opportunities.find((item) => matchesFormat(item) && matchesCause(item))
    ?? opportunities.find(matchesFormat)
    ?? opportunities[0];
  const explanation = goal === "aprender"
    ? "Suma tareas y habilidades que pueden ampliar tu trayectoria."
    : goal === "comunidad"
      ? "Prioriza una propuesta con impacto comunitario directo."
      : "Aprovecha coincidencias con habilidades y experiencias de tu perfil.";
  const viaState: ViaState = analyzing ? "thinking" : stage === "result" ? "celebration" : stage === "questions" ? "explanation" : open ? "greeting" : "waiting";

  function closeAssistant() {
    setOpen(false);
    setStage("invite");
  }

  async function analyze() {
    setAiExplanation("");
    setSemanticSuggestion(null);
    setStage("result");
    if (!user || user.isDemo || !suggested) return;
    setAnalyzing(true);
    try {
      const result = await analyzeSemanticCompatibility(profile, suggested);
      setAiExplanation(result.explanation);
      // OpenAI explica relaciones; el porcentaje siempre sale del motor determinista local.
      const compatibility = calculateCompatibility(profile, suggested);
      setSemanticSuggestion({ ...suggested, compatibility: compatibility.score, compatibilityBreakdown: compatibility.breakdown, recommendedBecause: result.explanation || compatibility.explanation });
    } catch {
      // Si la Function no está desplegada, Vía conserva la explicación reproducible del motor local.
    } finally { setAnalyzing(false); }
  }

  return <aside className={`guide-assistant ${open ? "open" : ""}`}>
    {open && <div className="assistant-panel">
      <header><ViaAvatar state={viaState} size={76} /><div><b>Vía</b><small>Estoy para ayudarte a encontrar dónde participar</small></div><button className="assistant-close" onClick={closeAssistant} aria-label="Minimizar a Vía">−</button></header>
      {stage === "invite" && <div className="assistant-invite"><p><b>¿Todavía no decidís dónde podés ayudar?</b> Te hago unas preguntas y buscamos una oportunidad para vos.</p><Button size="sm" onClick={() => setStage("questions")}>Sí, orientame <Sparkles /></Button><button onClick={closeAssistant}>Ahora no</button></div>}
      {stage === "questions" && <div className="assistant-questions"><p>{user?.role === "volunteer" ? `Hola, ${profile.name.split(" ")[0]}. Voy a tener en cuenta tus respuestas, tus ${profile.completedExperiences} experiencias y las habilidades que fuiste sumando.` : "Voy a tener en cuenta tus respuestas y lo que ofrece cada oportunidad."}</p><label>¿Qué te gustaría encontrar?<Select value={goal} onValueChange={setGoal}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="aprender">Aprender algo nuevo</SelectItem><SelectItem value="comunidad">Ayudar a mi comunidad</SelectItem><SelectItem value="experiencia">Fortalecer mi perfil</SelectItem></SelectContent></Select></label><label>¿Qué causa te interesa más?<Select value={cause} onValueChange={setCause}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cualquiera">Quiero descubrir</SelectItem>{ORGANIZATION_AREA_OPTIONS.map((area) => <SelectItem key={area} value={area}>{area}</SelectItem>)}</SelectContent></Select></label><label>¿Qué modalidad preferís?<Select value={format} onValueChange={setFormat}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cualquiera">Cualquiera</SelectItem><SelectItem value="presencial">Presencial</SelectItem><SelectItem value="virtual">Virtual</SelectItem><SelectItem value="híbrida">Híbrida</SelectItem></SelectContent></Select></label><Button size="sm" onClick={() => void analyze()}>Encontrar opciones <Bot /></Button></div>}
      {stage === "result" && suggested && <div className="assistant-recommendation"><span className="assistant-score">{semanticSuggestion?.compatibility ?? suggested.compatibility ?? 82}%</span><p>La mejor opción que encontré para vos es:</p><button className="assistant-result" onClick={() => { onOpenOpportunity(semanticSuggestion ?? suggested); closeAssistant(); }}><Sparkles /><span><small>Recomendación de Vía</small><b>{suggested.title}</b><em>{analyzing ? "Pensando cuál puede gustarte más…" : aiExplanation || suggested.recommendedBecause || explanation}</em></span><ChevronRight /></button><button className="assistant-restart" onClick={() => setStage("questions")}>Cambiar mis respuestas</button></div>}
    </div>}
    <button className="assistant-launcher" onClick={() => setOpen((value) => !value)} aria-label="Abrir a Vía, asistente orientador"><ViaAvatar state="waiting" size={78} /><b>¿Todavía no decidís dónde ayudar?</b></button>
  </aside>;
}

function Dashboard({ title, description, icon, action, children }: { title: string; description: string; icon: React.ReactNode; action: React.ReactNode; children: React.ReactNode }) {
  return <section className="dashboard-page"><div className="dashboard-hero"><span className="dashboard-icon">{icon}</span><div><span>Tu espacio</span><h1>{title}</h1><p>{description}</p></div><div>{action}</div></div><div className="dashboard-body">{children}</div></section>;
}

function Stat({ label, value, detail }: { label: string; value: number; detail: string }) { return <article className="stat-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="profile-info-row"><small>{label}</small><b>{value}</b></div>; }

// El mapa usa la ubicación pública de la oportunidad; nunca solicita la ubicación del voluntario.
function OpportunityLocation({ opportunity }: { opportunity: Opportunity }) {
  if (opportunity.modality === "Virtual") {
    return <p className="privacy-note"><Globe2 /><span><b>Actividad virtual</b>{readableText(opportunity.addressHint)}</span></p>;
  }

  const query = [opportunity.neighborhood, opportunity.province, "Argentina"].filter(Boolean).join(", ");
  const encodedQuery = encodeURIComponent(query);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
  const embedUrl = `https://www.google.com/maps?q=${encodedQuery}&output=embed`;

  return <section className="opportunity-location" aria-label="Ubicación aproximada de la oportunidad">
    <iframe
      title={`Mapa de ${readableText(opportunity.neighborhood)}`}
      src={embedUrl}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
    <div className="opportunity-location-copy">
      <span><MapPin /><span><small>Ubicación</small><b>{readableText(opportunity.neighborhood)}, {readableText(opportunity.province)}</b></span></span>
      <a href={mapsUrl} target="_blank" rel="noreferrer">Abrir en Google Maps <ExternalLink /></a>
      <p>{readableText(opportunity.addressHint)}</p>
    </div>
  </section>;
}

function OpportunityDialog({ opportunity, user, applications, open, onOpenChange, onApply, onViewOrganization }: { opportunity: Opportunity | null; user: SessionUser | null; applications: Application[]; open: boolean; onOpenChange: (open: boolean) => void; onApply: (item: Opportunity) => void; onViewOrganization: (organizationId: string) => void }) {
  const [activePhoto, setActivePhoto] = useState(0);
  if (!opportunity) return null;
  const gallery = opportunity.imageUrls?.length ? opportunity.imageUrls : [opportunity.imageUrl];
  const applied = Boolean(user && applications.some((item) => item.opportunityId === opportunity.id && item.userId === user.uid && blocksNewApplication(item)));
  const unavailableForRole = Boolean(user && user.role !== "volunteer");
  const breakdown = opportunity.compatibilityBreakdown;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="opportunity-dialog"><div className="dialog-cover" style={{ backgroundImage: `url(${gallery[activePhoto] ?? opportunity.imageUrl})` }}><Badge>{readableText(opportunity.category)}</Badge>{opportunity.simulated && <SimulatedSeal />}</div>{gallery.length > 1 && <div className="dialog-gallery" aria-label="Fotos de la oportunidad">{gallery.map((photo, index) => <button key={`${photo.slice(-20)}-${index}`} className={index === activePhoto ? "active" : ""} style={{ backgroundImage: `url(${photo})` }} onClick={() => setActivePhoto(index)} aria-label={`Ver foto ${index + 1}`} aria-pressed={index === activePhoto} />)}</div>}<DialogHeader><DialogTitle>{readableText(opportunity.title)}</DialogTitle><DialogDescription>{readableText(opportunity.organization)}</DialogDescription><button className="organization-profile-link" type="button" onClick={() => onViewOrganization(opportunity.organizationId)}>Ver perfil de la organización <ChevronRight /></button></DialogHeader>{opportunity.compatibility !== undefined && <div className="compatibility-detail"><strong>{opportunity.compatibility}% coincide con tu perfil</strong>{breakdown && <div>{Object.entries(breakdown).map(([key, value]) => <span key={key}>{({ skills: "Habilidades", interests: "Intereses", availability: "Disponibilidad", location: "Ubicación/modalidad", experience: "Experiencias" } as Record<string, string>)[key]}: {value}%</span>)}</div>}<p>{opportunity.recommendedBecause}</p></div>}<div className="dialog-facts"><span><CalendarDays /> {readableText(opportunity.dateLabel)}</span><span><Clock3 /> {opportunity.time}</span><span><MapPin /> {readableText(opportunity.neighborhood)}</span><span>{opportunity.modality ?? "Presencial"}</span></div><p className="dialog-description">{readableText(opportunity.description)}</p><div className="dialog-columns"><section><h3>Tareas</h3>{opportunity.tasks.map((item) => <p key={item}><Check /> {readableText(item)}</p>)}</section><section><h3>Habilidades requeridas</h3>{(opportunity.requiredSkills ?? opportunity.requirements).map((item) => <p key={item}><Check /> {readableText(item)}</p>)}</section></div><OpportunityLocation opportunity={opportunity} /><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button><Button disabled={applied || unavailableForRole} onClick={() => onApply(opportunity)}>{applied ? "Interés registrado" : unavailableForRole ? "Disponible para voluntarios" : "Me interesa"}</Button></DialogFooter></DialogContent></Dialog>;
}

function PublicOrganizationDialog({ organization, opportunities, open, onOpenChange }: { organization: Organization | null; opportunities: Opportunity[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!organization) return null;
  const published = opportunities.filter((item) => item.organizationId === organization.id && item.status === "published");
  const links = organization.socialLinks ?? {};
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="public-organization-dialog"><div className="public-organization-hero"><div className="public-organization-photo" style={organization.imageUrl ? { backgroundImage: `url(${organization.imageUrl})` } : undefined}>{!organization.imageUrl && <Building2 />}</div><div><span>Organización verificada</span><h2>{organization.name}</h2><p><MapPin /> {organization.location ?? organization.province}</p></div></div><div className="public-organization-body"><p>{organization.description}</p><div className="tag-row">{(organization.areas ?? []).map((area) => <Badge key={area} variant="secondary">{area}</Badge>)}</div>{Object.values(links).some(Boolean) && <div className="social-links public-organization-socials">{links.instagram && <a href={links.instagram} target="_blank" rel="noreferrer"><Globe2 /> Instagram</a>}{links.linkedin && <a href={links.linkedin} target="_blank" rel="noreferrer"><Globe2 /> LinkedIn</a>}{links.other && <a href={links.other} target="_blank" rel="noreferrer"><ExternalLink /> Sitio web</a>}</div>}<section><div className="panel-heading"><div><span>Oportunidades</span><h3>Propuestas publicadas</h3></div><Badge variant="secondary">{published.length}</Badge></div><div className="public-organization-opportunities">{published.slice(0, 4).map((item) => <article key={item.id}><div style={{ backgroundImage: `url(${item.imageUrl})` }} /><span><b>{item.title}</b><small>{item.category} · {item.neighborhood}</small></span></article>)}{!published.length && <p className="panel-note">Todavía no tiene oportunidades publicadas.</p>}</div></section></div><DialogFooter><Button onClick={() => onOpenChange(false)}>Cerrar</Button></DialogFooter></DialogContent></Dialog>;
}

function AuthDialog({ open, onOpenChange, onUser }: { open: boolean; onOpenChange: (open: boolean) => void; onUser: (user: SessionUser) => void }) {
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);
  async function login(role: SessionUser["role"]) { setLoading(true); try { const next = await firebaseSignInWithGoogle(role); onUser(next); } catch (error) { toast.error("No pudimos iniciar sesión", { description: authErrorMessage(error) }); } finally { setLoading(false); } }
  function changeOpen(nextOpen: boolean) { if (!nextOpen) setConsent(false); onOpenChange(nextOpen); }
  return <Dialog open={open} onOpenChange={changeOpen}><DialogContent className="auth-dialog"><DialogHeader><span className="auth-mark"><Image src="/brand/icon-voluntariando-64.png" alt="Logo de Voluntariando" width={64} height={64} /></span><DialogTitle>Ingresá con Google</DialogTitle><DialogDescription>En el primer acceso elegí el perfil que vas a utilizar.</DialogDescription></DialogHeader><label className="consent-box"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span><b>Consentimiento para la prueba</b>Entiendo que se guardarán mi nombre, correo y los datos que complete en mi perfil exclusivamente para probar el prototipo de la tesis.</span></label><Button variant="outline" onClick={() => void login("volunteer")} disabled={loading || !consent}><UserRound /> Continuar como voluntario</Button><Button variant="outline" onClick={() => void login("organization")} disabled={loading || !consent}><Building2 /> Continuar como organización</Button><Button variant="outline" onClick={() => void login("admin")} disabled={loading || !consent}><Shield /> Acceso de administrador</Button></DialogContent></Dialog>;
}

function VolunteerProfileDialog({ user, profile, open, onOpenChange, onSaved, mandatory = false }: { user: SessionUser; profile: VolunteerProfile; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (profile: VolunteerProfile) => void; mandatory?: boolean }) {
  function normalizeUrl(value: FormDataEntryValue | null) { const clean = String(value ?? "").trim(); if (!clean) return ""; return clean.startsWith("http://") || clean.startsWith("https://") ? clean : `https://${clean}`; }
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const socialLinks = { instagram: normalizeUrl(form.get("instagram")), linkedin: normalizeUrl(form.get("linkedin")), other: normalizeUrl(form.get("other")) }; const next = { ...profile, name: readableText(form.get("name")), location: readableText(form.get("location")), bio: readableText(form.get("bio")), interests: form.getAll("interests").map(String), declaredSkills: readableList(form.get("skills")), availability: form.getAll("availability").map(String), socialLinks, visibleToOrganizations: form.has("visibleToOrganizations"), visibleToVolunteers: form.has("visibleToVolunteers") }; if (!next.name || !next.location || !next.interests.length || !next.declaredSkills.length || !next.availability.length) return toast.error("Completá nombre, ubicación, intereses, habilidades y disponibilidad."); try { Object.values(socialLinks).filter(Boolean).forEach((value) => new URL(value)); } catch { return toast.error("Revisá los enlaces de tus redes sociales."); } try { if (!user.isDemo) await saveVolunteerProfile(next); onSaved(next); onOpenChange(false); toast.success("Perfil actualizado"); } catch (error) { toast.error("No pudimos guardar", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); } }
  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!mandatory || nextOpen) onOpenChange(nextOpen); }}><DialogContent className="create-dialog" showCloseButton={!mandatory} onEscapeKeyDown={mandatory ? (event) => event.preventDefault() : undefined} onPointerDownOutside={mandatory ? (event) => event.preventDefault() : undefined}><DialogHeader><DialogTitle>{mandatory ? "Completá tu perfil para continuar" : "Configurar perfil"}</DialogTitle><DialogDescription>{mandatory ? "Elegí opciones simples para empezar. Después vas a poder modificarlas." : "Estos datos nos ayudan a mostrarte oportunidades más cercanas a tus intereses."}</DialogDescription></DialogHeader><form className="create-form" onSubmit={submit}><label>Nombre<Input name="name" defaultValue={profile.name} autoCapitalize="words" required /></label><label>Ciudad o localidad<Input name="location" defaultValue={profile.location} placeholder="Ej.: Córdoba capital" autoCapitalize="words" required /></label><label className="full">Sobre mí<Textarea name="bio" defaultValue={profile.bio} autoCapitalize="sentences" spellCheck /></label><fieldset className="skill-checks full"><legend>¿Qué causas te interesan?</legend><p>Elegí una o varias opciones.</p><div>{ORGANIZATION_AREA_OPTIONS.map((interest) => <label key={interest}><input type="checkbox" name="interests" value={interest} defaultChecked={profile.interests.includes(interest)} />{interest}</label>)}</div></fieldset><label className="full">¿Qué habilidades tenés?<Input name="skills" defaultValue={(profile.declaredSkills ?? []).join(", ")} placeholder="Ej.: Trabajo en equipo, creatividad" autoCapitalize="sentences" spellCheck required /><small>Acá podés expresarte libremente y separar varias con coma.</small></label><fieldset className="skill-checks full"><legend>¿Cuándo podrías participar?</legend><p>Elegí todas las opciones que te resulten cómodas.</p><div>{AVAILABILITY_OPTIONS.map((availability) => <label key={availability}><input type="checkbox" name="availability" value={availability} defaultChecked={(profile.availability ?? []).includes(availability)} />{availability}</label>)}</div></fieldset><div className="form-divider full"><b>Privacidad del perfil</b><small>Podés cambiar estas opciones en cualquier momento.</small></div><label className="simple-check full"><input type="checkbox" name="visibleToOrganizations" defaultChecked={profile.visibleToOrganizations} />Permitir que organizaciones encuentren mi perfil</label><label className="simple-check full"><input type="checkbox" name="visibleToVolunteers" defaultChecked={profile.visibleToVolunteers} />Mostrar mi perfil a otros voluntarios</label><div className="form-divider full"><b>Redes sociales opcionales</b><small>Solo se mostrarán los enlaces que decidas completar.</small></div><label>Instagram<Input name="instagram" defaultValue={profile.socialLinks?.instagram} placeholder="instagram.com/usuario" /></label><label>LinkedIn<Input name="linkedin" defaultValue={profile.socialLinks?.linkedin} placeholder="linkedin.com/in/usuario" /></label><label className="full">Otra red o sitio<Input name="other" defaultValue={profile.socialLinks?.other} placeholder="https://..." /></label><DialogFooter className="full">{!mandatory && <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>}<Button type="submit">{mandatory ? "Guardar y entrar" : "Guardar perfil"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function ReviewDialog({ user, application, organizationName, open, onOpenChange, onSaved }: { user: SessionUser; application: Application | null; organizationName: string; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (review: Review) => void }) {
  const [rating, setRating] = useState("5");
  const [anonymous, setAnonymous] = useState(true);
  if (!application) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const comment = String(form.get("comment")).trim();
    const photoEntry = form.get("photo");
    const photo = photoEntry instanceof File && photoEntry.size > 0 ? photoEntry : undefined;
    if (comment.length < 10) return toast.error("Contanos un poco más sobre la experiencia.");
    if (photo && (!photo.type.startsWith("image/") || photo.size > 5 * 1024 * 1024)) return toast.error("La foto debe ser una imagen de hasta 5 MB.");
    const data = {
      applicationId: application!.id, opportunityId: application!.opportunityId, opportunityTitle: application!.opportunityTitle,
      organizationId: application!.organizationId, organizationName, userId: user.uid,
      authorName: anonymous ? "Voluntario anónimo" : user.displayName, rating: Number(rating), comment,
    };
    try {
      const next: Review = user.isDemo
        ? { ...data, id: application!.id, status: "published", createdAt: new Date().toISOString() }
        : await createReview(data, photo);
      onSaved(next);
      onOpenChange(false);
      toast.success("Reseña publicada", { description: photo ? "La foto aparecerá cuando administración la apruebe." : undefined });
    } catch (error) { toast.error("No pudimos publicar la reseña", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>Compartí tu experiencia</DialogTitle><DialogDescription>{application.opportunityTitle} · El texto se publica al instante; la foto requiere aprobación.</DialogDescription></DialogHeader><form className="create-form" onSubmit={submit}><label>Puntuación<Select value={rating} onValueChange={setRating}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[5, 4, 3, 2, 1].map((value) => <SelectItem key={value} value={String(value)}>{"★".repeat(value)} {value} estrellas</SelectItem>)}</SelectContent></Select></label><label className="simple-check"><input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} />Publicar como Voluntario anónimo</label><label className="full">¿Cómo fue la experiencia?<Textarea name="comment" minLength={10} maxLength={600} placeholder="Contá qué hiciste y qué te pareció la organización." required /></label><label className="full">Foto opcional<Input name="photo" type="file" accept="image/*" /><small>Máximo 5 MB. Quedará pendiente hasta que administración la apruebe.</small></label><DialogFooter className="full"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit">Publicar reseña</Button></DialogFooter></form></DialogContent></Dialog>;
}

function ReviewReportDialog({ user, review, open, onOpenChange }: { user: SessionUser | null; review: Review | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!user || !review) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason")).trim();
    if (reason.length < 5) return toast.error("Explicá brevemente el motivo de la denuncia.");
    try {
      if (!user!.isDemo) await reportReview(review!.id, user!.uid, reason);
      onOpenChange(false);
      toast.success("Denuncia enviada", { description: "Administración revisará la reseña; no se oculta automáticamente." });
    } catch (error) { toast.error("No pudimos enviar la denuncia", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>Denunciar reseña</DialogTitle><DialogDescription>La revisión queda a cargo de administración. Una denuncia no elimina contenido automáticamente.</DialogDescription></DialogHeader><form className="create-form" onSubmit={submit}><label className="full">Motivo<Textarea name="reason" minLength={5} maxLength={400} placeholder="Explicá qué debería revisar administración." required /></label><DialogFooter className="full"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" variant="destructive">Enviar denuncia</Button></DialogFooter></form></DialogContent></Dialog>;
}

function OrganizationProfileDialog({ user, organization, open, onOpenChange, onSaved, mandatory = false }: { user: SessionUser; organization: Organization; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (organization: Organization) => void; mandatory?: boolean }) {
  const [imageUrl, setImageUrl] = useState(organization.imageUrl ?? "");
  const [loadingPhoto, setLoadingPhoto] = useState(false);

  function normalizeUrl(value: FormDataEntryValue | null) {
    const clean = String(value ?? "").trim();
    if (!clean) return "";
    return clean.startsWith("http://") || clean.startsWith("https://") ? clean : `https://${clean}`;
  }

  async function changePhoto(file: File | undefined) {
    if (!file) return;
    setLoadingPhoto(true);
    try {
      setImageUrl(await compressOpportunityPhoto(file));
    } catch (error) {
      toast.error("No pudimos preparar la foto", { description: error instanceof Error ? error.message : "Probá con otra imagen." });
    } finally {
      setLoadingPhoto(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const areas = form.getAll("areas").map(String);
    const socialLinks = {
      instagram: normalizeUrl(form.get("instagram")),
      linkedin: normalizeUrl(form.get("linkedin")),
      other: normalizeUrl(form.get("other")),
    };
    const next = {
      ...organization,
      name: readableText(form.get("name")),
      description: readableText(form.get("description")),
      areas,
      location: readableText(form.get("location")),
      province: readableText(form.get("province")),
      contact: String(form.get("contact")).trim(),
      imageUrl,
      socialLinks,
    };
    if (!next.name || !next.description || !next.location || !next.contact || !areas.length) return toast.error("Completá todos los campos y elegí al menos un área de trabajo.");
    try { Object.values(socialLinks).filter(Boolean).forEach((value) => new URL(value)); }
    catch { return toast.error("Revisá los enlaces de las redes sociales."); }
    try {
      if (!user.isDemo) await saveOrganizationProfile(next);
      onSaved(next);
      onOpenChange(false);
      toast.success("Perfil actualizado");
    } catch (error) {
      toast.error("No pudimos guardar", { description: error instanceof Error ? error.message : "Intentá nuevamente." });
    }
  }

  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!mandatory || nextOpen) onOpenChange(nextOpen); }}><DialogContent className="create-dialog organization-profile-editor" showCloseButton={!mandatory} onEscapeKeyDown={mandatory ? (event) => event.preventDefault() : undefined} onPointerDownOutside={mandatory ? (event) => event.preventDefault() : undefined}><DialogHeader><DialogTitle>{mandatory ? "Completá la organización para continuar" : "Perfil de la organización"}</DialogTitle><DialogDescription>{mandatory ? "Elegí las opciones básicas para empezar. Después vas a poder modificar todo." : "La descripción, la foto, las áreas y las redes serán visibles para voluntarios."}</DialogDescription></DialogHeader><form className="create-form" onSubmit={submit}><div className="organization-photo-editor full"><div className="organization-photo-preview" style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}>{!imageUrl && <Building2 />}</div><div><b>Foto de perfil</b><small>Se mostrará en el perfil público de la organización.</small><label className="photo-upload">{imageUrl ? "Cambiar foto" : "Agregar foto"}<Input type="file" accept="image/*" disabled={loadingPhoto} onChange={(event) => void changePhoto(event.target.files?.[0])} /></label>{imageUrl && <Button type="button" size="sm" variant="outline" onClick={() => setImageUrl("")}>Quitar foto</Button>}</div></div><label>Nombre<Input name="name" defaultValue={organization.name} autoCapitalize="words" required /></label><label>Provincia<Select name="province" defaultValue={organization.province || "Córdoba"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ARGENTINA_PROVINCES.map((province) => <SelectItem key={province} value={province}>{province}</SelectItem>)}</SelectContent></Select></label><label className="full">Descripción pública<Textarea name="description" defaultValue={organization.description} autoCapitalize="sentences" spellCheck required /></label><fieldset className="skill-checks full"><legend>Áreas de trabajo</legend><p>Elegí una o varias áreas que representen la actividad de la organización.</p><div>{ORGANIZATION_AREA_OPTIONS.map((area) => <label key={area}><input type="checkbox" name="areas" value={area} defaultChecked={(organization.areas ?? []).includes(area)} />{area}</label>)}</div></fieldset><label>Ciudad o localidad<Input name="location" defaultValue={organization.location} placeholder="Ej.: Córdoba capital" autoCapitalize="words" required /></label><label>Correo de contacto<Input name="contact" type="email" defaultValue={organization.contact} required /></label><div className="form-divider full"><b>Redes sociales opcionales</b><small>Solo se mostrarán públicamente los enlaces que completes.</small></div><label>Instagram<Input name="instagram" defaultValue={organization.socialLinks?.instagram} placeholder="instagram.com/organizacion" /></label><label>LinkedIn<Input name="linkedin" defaultValue={organization.socialLinks?.linkedin} placeholder="linkedin.com/company/organizacion" /></label><label className="full">Sitio web u otra red<Input name="other" defaultValue={organization.socialLinks?.other} placeholder="https://..." /></label><DialogFooter className="full">{!mandatory && <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>}<Button type="submit" disabled={loadingPhoto}>{mandatory ? "Guardar y entrar" : "Guardar"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function InvitationDialog({ user, organization, volunteer, opportunities, open, onOpenChange, onSaved }: { user: SessionUser; organization: Organization; volunteer: VolunteerProfile | null; opportunities: Opportunity[]; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (invitation: Invitation) => void }) {
  const [loading, setLoading] = useState(false);
  if (!volunteer) return null;
  const rankedOpportunities = recommendOpportunities(opportunities, volunteer);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const opportunity = opportunities.find((item) => item.id === String(form.get("opportunityId")));
    const message = String(form.get("message")).trim();
    if (!opportunity || message.length < 10) return toast.error("Elegí una oportunidad y escribí un mensaje breve.");
    setLoading(true);
    try {
      const next = user.isDemo
        ? { id: `demo-invitation-${Date.now()}`, opportunityId: opportunity.id, opportunityTitle: opportunity.title, organizationId: organization.id, organizationName: organization.name, organizationContact: organization.contact ?? organization.email, userId: volunteer!.id, userName: volunteer!.name, message, status: "pending" as const, createdAt: new Date().toISOString() }
        : await createInvitation(user, organization, opportunity, volunteer!, message);
      onSaved(next);
      onOpenChange(false);
      toast.success("Propuesta enviada", { description: `${volunteer!.name} podrá aceptarla o rechazarla desde su espacio.` });
    } catch (error) { toast.error("No pudimos enviar la propuesta", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); }
    finally { setLoading(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>Invitar a {volunteer.name}</DialogTitle><DialogDescription>La propuesta llegará como notificación. Desde ahí podrá abrir la oportunidad antes de aceptar o rechazar.</DialogDescription></DialogHeader><form className="create-form" onSubmit={submit}><label className="full">Oportunidad<Select name="opportunityId" defaultValue={rankedOpportunities[0]?.id}><SelectTrigger><SelectValue placeholder="Elegí una oportunidad" /></SelectTrigger><SelectContent>{rankedOpportunities.map((item) => <SelectItem key={item.id} value={item.id}>{item.title} · {item.compatibility ?? 0}%</SelectItem>)}</SelectContent></Select></label><label className="full">Mensaje<Textarea name="message" minLength={10} maxLength={400} defaultValue={`Hola ${volunteer.name}, creemos que tu perfil puede aportar mucho a esta oportunidad. ¿Te gustaría participar?`} required /></label><DialogFooter className="full"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={loading}>{loading ? "Enviando…" : "Enviar propuesta"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function OpportunityEditor({ user, organization, opportunity, open, onOpenChange, onSaved }: { user: SessionUser; organization: Organization; opportunity: Opportunity | null; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (opportunity: Opportunity) => void }) {
  const initialTime = opportunity?.time ?? OPPORTUNITY_TIME_OPTIONS[0];
  const usesPresetTime = (OPPORTUNITY_TIME_OPTIONS as readonly string[]).includes(initialTime);
  const [initialStart = "09:00", initialEnd = "12:00"] = initialTime.split(/[\-–]/).map((value) => value.trim());
  const [time, setTime] = useState<string>(usesPresetTime ? initialTime : "Personalizado");
  const [customTime, setCustomTime] = useState({ start: initialStart, end: initialEnd });
  const [photos, setPhotos] = useState<string[]>(opportunity?.imageUrls?.length ? opportunity.imageUrls : opportunity?.imageUrl ? [opportunity.imageUrl] : []);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const available = 4 - photos.length;
    if (available <= 0) return toast.info("Podés publicar hasta cuatro fotos.");
    setLoadingPhotos(true);
    try {
      const selected = Array.from(files).slice(0, available);
      const compressed = await Promise.all(selected.map(compressOpportunityPhoto));
      setPhotos((current) => [...current, ...compressed].slice(0, 4));
      if (files.length > available) toast.info("Se agregaron las primeras cuatro fotos permitidas.");
    } catch (error) {
      toast.error("No pudimos preparar la foto", { description: error instanceof Error ? error.message : "Probá con otra imagen." });
    } finally {
      setLoadingPhotos(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get("date"));
    const selectedTime = time === "Personalizado" ? `${customTime.start}–${customTime.end}` : time;
    const imageUrls = photos.length ? photos : [DEFAULT_OPPORTUNITY_IMAGE];
    const capacity = Number(form.get("capacity"));
    const data: Omit<Opportunity, "id"> = {
      title: readableText(form.get("title")),
      organization: organization.name,
      organizationId: organization.id,
      description: readableText(form.get("description")),
      tasks: readableList(form.get("tasks")),
      requirements: readableList(form.get("requirements")),
      requiredSkills: readableList(form.get("skills")),
      availability: form.getAll("availability").map(String),
      modality: String(form.get("modality")) as Opportunity["modality"],
      date,
      dateLabel: readableText(new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))),
      time: selectedTime,
      neighborhood: readableText(form.get("location")),
      addressHint: readableText(form.get("location")),
      latitude: opportunity?.latitude ?? -31.4167,
      longitude: opportunity?.longitude ?? -64.1833,
      distanceKm: opportunity?.distanceKm ?? 0,
      capacity,
      availableSpots: opportunity ? Math.max(0, capacity - (opportunity.capacity - opportunity.availableSpots)) : capacity,
      category: String(form.get("category")),
      province: readableText(form.get("province")),
      imageUrl: imageUrls[0],
      imageUrls,
      visibility: opportunity?.visibility ?? "public",
      status: opportunity?.status ?? "published",
    };
    if (!data.title || !data.description || !data.tasks.length || !data.requiredSkills?.length || !data.availability?.length || !selectedTime) return toast.error("Completá todos los datos necesarios para publicar la oportunidad.");
    if (time === "Personalizado" && (!customTime.start || !customTime.end || customTime.start >= customTime.end)) return toast.error("Revisá el horario de inicio y finalización.");
    try {
      const next = opportunity ? { ...data, id: opportunity.id } : user.isDemo ? { ...data, id: `demo-${Date.now()}` } : await createOpportunity(data);
      if (opportunity && !user.isDemo) await updateOpportunity(next);
      onSaved(next);
      onOpenChange(false);
      toast.success(opportunity ? "Oportunidad actualizada" : "Oportunidad publicada");
    } catch (error) {
      toast.error("No pudimos guardar", { description: error instanceof Error ? error.message : "Intentá nuevamente." });
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-dialog opportunity-editor"><DialogHeader><DialogTitle>{opportunity ? "Editar oportunidad" : "Nueva oportunidad"}</DialogTitle><DialogDescription>Elegí opciones simples y agregá hasta cuatro fotos. Las mayúsculas iniciales se corrigen al guardar.</DialogDescription></DialogHeader><form className="create-form" onSubmit={submit}><label className="full">Título<Input name="title" defaultValue={opportunity?.title} autoCapitalize="sentences" spellCheck required /></label><label className="full">Descripción<Textarea name="description" defaultValue={opportunity?.description} autoCapitalize="sentences" spellCheck required /></label><label>Área de interés<Select name="category" defaultValue={opportunity?.category ?? ORGANIZATION_AREA_OPTIONS[0]}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ORGANIZATION_AREA_OPTIONS.map((area) => <SelectItem key={area} value={area}>{area}</SelectItem>)}</SelectContent></Select></label><label>Modalidad<Select name="modality" defaultValue={opportunity?.modality ?? "Presencial"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Presencial">Presencial</SelectItem><SelectItem value="Virtual">Virtual</SelectItem><SelectItem value="Híbrida">Híbrida</SelectItem></SelectContent></Select></label><label>Provincia<Select name="province" defaultValue={opportunity?.province ?? "Córdoba"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ARGENTINA_PROVINCES.map((province) => <SelectItem key={province} value={province}>{province}</SelectItem>)}</SelectContent></Select></label><label>Ubicación para el mapa<Input name="location" defaultValue={opportunity?.neighborhood} placeholder="Ej.: B° Güemes o Los Gigantes" autoCapitalize="words" spellCheck required /></label><label>Fecha<Input type="date" name="date" defaultValue={opportunity?.date} required /></label><label>Horario<Select value={time} onValueChange={setTime}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{OPPORTUNITY_TIME_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}<SelectItem value="Personalizado">Elegir otro horario</SelectItem></SelectContent></Select></label>{time === "Personalizado" && <div className="time-range full"><label>Desde<Input type="time" value={customTime.start} onChange={(event) => setCustomTime((current) => ({ ...current, start: event.target.value }))} required /></label><label>Hasta<Input type="time" value={customTime.end} onChange={(event) => setCustomTime((current) => ({ ...current, end: event.target.value }))} required /></label></div>}<label>Cupos<Input type="number" min="1" name="capacity" defaultValue={opportunity?.capacity ?? 10} required /></label><fieldset className="skill-checks full"><legend>Disponibilidad solicitada</legend><p>Elegí una o varias franjas.</p><div>{AVAILABILITY_OPTIONS.map((availability) => <label key={availability}><input type="checkbox" name="availability" value={availability} defaultChecked={(opportunity?.availability ?? []).includes(availability)} />{availability}</label>)}</div></fieldset><label className="full">Tareas a realizar<Input name="tasks" defaultValue={opportunity?.tasks.join(", ")} placeholder="Ej.: Preparar materiales, acompañar al grupo" autoCapitalize="sentences" spellCheck required /><small>Podés escribir varias y separarlas con coma.</small></label><label className="full">Habilidades que ayudarían<Input name="skills" defaultValue={(opportunity?.requiredSkills ?? []).join(", ")} placeholder="Ej.: Creatividad, trabajo en equipo" autoCapitalize="sentences" spellCheck required /><small>Este campo queda libre para describir lo que realmente necesita la actividad.</small></label><label className="full">Requisitos adicionales<Input name="requirements" defaultValue={opportunity?.requirements.join(", ")} autoCapitalize="sentences" spellCheck /></label><div className="opportunity-photo-editor full"><div><b>Fotos de la oportunidad</b><small>La primera será la portada. Podés cambiar el orden, quitar fotos o sumar nuevas.</small></div><div className="opportunity-photo-previews">{photos.map((photo, index) => <article key={`${photo.slice(-24)}-${index}`} style={{ backgroundImage: `url(${photo})` }}><span>{index === 0 ? "Portada" : `Foto ${index + 1}`}</span><div>{index > 0 && <Button type="button" size="sm" variant="secondary" onClick={() => setPhotos((current) => [current[index], ...current.filter((_, photoIndex) => photoIndex !== index)])}>Usar de portada</Button>}<Button type="button" size="sm" variant="destructive" onClick={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))}>Quitar</Button></div></article>)}</div>{photos.length < 4 && <label className="photo-upload">Agregar fotos<Input type="file" accept="image/*" multiple disabled={loadingPhotos} onChange={(event) => void addPhotos(event.target.files)} /><small>{loadingPhotos ? "Preparando imágenes…" : `${photos.length} de 4 fotos`}</small></label>}</div><p className="form-help full">Revisamos mayúsculas iniciales y espacios automáticamente. El corrector del navegador te ayuda con la ortografía antes de publicar.</p><DialogFooter className="full"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={loadingPhotos}>{opportunity ? "Guardar cambios" : "Publicar"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function AbsenceDialog({ user, organization, application, open, onOpenChange, onSaved }: { user: SessionUser; organization: Organization; application: Application | null; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (application: Application) => void }) {
  const [loading, setLoading] = useState(false);
  if (!application) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason")).trim();
    if (reason.length < 10) return toast.error("Describí brevemente qué ocurrió.");
    setLoading(true);
    try {
      const next = user.isDemo ? { ...application!, absentAt: new Date().toISOString() } : await recordAbsence(application!, user, organization, reason);
      onSaved(next); onOpenChange(false);
      toast.info("Ausencia informada", { description: "Administración deberá corroborarla antes de sumarla al historial." });
    } catch (error) { toast.error("No se pudo registrar", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); }
    finally { setLoading(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>Informar ausencia</DialogTitle><DialogDescription>{application.userName} · {application.opportunityTitle}</DialogDescription></DialogHeader><form className="create-form" onSubmit={submit}><label className="full">¿Qué ocurrió?<Textarea name="reason" minLength={10} maxLength={600} placeholder="Indicá si no asistió o si avisó con menos de 6 horas de anticipación." required /></label><p className="panel-note full">El reporte quedará pendiente. No contará como ausencia ni generará una sanción hasta que administración lo revise.</p><DialogFooter className="full"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={loading}>{loading ? "Enviando…" : "Enviar a revisión"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function ExperienceDialog({ user, organization, application, open, onOpenChange, onCompleted }: { user: SessionUser; organization: Organization; application: Application | null; open: boolean; onOpenChange: (open: boolean) => void; onCompleted: (application: Application, skills: string[], tasks: string[]) => void }) {
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [assessment, setAssessment] = useState<"positive" | "needs_improvement">("positive");
  if (!application) return null;
  function toggleSkill(name: string) {
    setSelectedSkills((current) => {
      if (current.includes(name)) return current.filter((item) => item !== name);
      if (current.length >= 3) {
        toast.warning("Podés registrar hasta tres habilidades por experiencia.");
        return current;
      }
      return [...current, name];
    });
  }
  function changeOpen(nextOpen: boolean) { if (!nextOpen) { setSelectedSkills([]); setAssessment("positive"); } onOpenChange(nextOpen); }
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const tasks = splitList(form.get("tasks")); const skills = selectedSkills; const details = String(form.get("details")).trim(); if (!tasks.length) return toast.error("Detallá las tareas que realizó la persona voluntaria."); if (assessment === "needs_improvement" && details.length < 15) return toast.error("Explicá el aspecto a mejorar con suficiente detalle."); try { if (!user.isDemo) await recordCompletedExperience(application!, { tasks, skills, organizationName: organization.name, submittedByEmail: user.email, assessment, details }); const next = { ...application!, completedAt: new Date().toISOString() }; onCompleted(next, skills, tasks); changeOpen(false); if (assessment === "needs_improvement") toast.info("Experiencia registrada", { description: "La observación quedó pendiente de corroboración administrativa." }); else if (!skills.length) toast.warning("Experiencia registrada sin habilidades verificadas", { description: "La trayectoria se guardó, pero no aportará nuevas habilidades a las recomendaciones." }); else toast.success("Experiencia incorporada a la trayectoria"); } catch (error) { toast.error("No pudimos registrar la experiencia", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); } }
  return <Dialog open={open} onOpenChange={changeOpen}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>Registrar participación realizada</DialogTitle><DialogDescription>{application.userName} · {application.opportunityTitle}</DialogDescription></DialogHeader><form className="create-form" onSubmit={submit}><label className="full">¿Qué tareas realizó? Separalas por coma<Input name="tasks" placeholder="Preparó materiales, coordinó el juego" required /></label><fieldset className="skill-checks full"><legend>Habilidades demostradas</legend><p>Seleccioná hasta tres habilidades observadas durante esta experiencia.</p><div>{VERIFIED_SKILL_OPTIONS.map((skill) => <label key={skill}><input type="checkbox" checked={selectedSkills.includes(skill)} disabled={!selectedSkills.includes(skill) && selectedSkills.length >= 3} onChange={() => toggleSkill(skill)} />{skill}</label>)}</div></fieldset><span className="skill-counter full">{selectedSkills.length} de 3 habilidades seleccionadas</span><label>Evaluación<Select value={assessment} onValueChange={(value) => setAssessment(value as typeof assessment)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="positive">Experiencia satisfactoria</SelectItem><SelectItem value="needs_improvement">Hay aspectos a mejorar</SelectItem></SelectContent></Select></label><label className="full">{assessment === "needs_improvement" ? "¿Qué debería mejorar?" : "Comentario de la organización"}<Textarea name="details" minLength={assessment === "needs_improvement" ? 15 : 0} maxLength={600} placeholder={assessment === "needs_improvement" ? "Describí hechos concretos. Administración podrá contactarte para corroborarlos." : "Comentario opcional sobre la participación."} required={assessment === "needs_improvement"} /></label>{assessment === "needs_improvement" && <p className="panel-note full">Esta observación no suspende la cuenta automáticamente: primero debe revisarla administración.</p>}<DialogFooter className="full"><Button type="button" variant="outline" onClick={() => changeOpen(false)}>Cancelar</Button><Button type="submit">Completar participación</Button></DialogFooter></form></DialogContent></Dialog>;
}
