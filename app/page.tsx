"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ArrowRight, Ban, Bot, Building2, CalendarDays, Check, ChevronRight, CirclePlay, Clock3,
  Globe2, HeartHandshake, LogOut, Map, MapPin, Moon, Pencil, Plus, Search, Settings2,
  Shield, ShieldCheck, Sparkles, Sun, UserCog, UserRound, Users,
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
import { DEMO_APPLICATIONS, DEMO_OPPORTUNITIES, DEMO_REVIEW_REPORTS, DEMO_REVIEWS, DEMO_VOLUNTEERS } from "@/lib/demo-data";
import {
  adminModerateReview, adminModerateReviewPhoto, adminUpdateOpportunity, adminUpdateUser, authErrorMessage, createApplication, createInvitation, createOpportunity, createReview, firebaseSignInWithGoogle, firebaseSignOut,
  observeAdminOpportunities, observeAdminReviewPhotos, observeAdminReviewReports, observeAdminReviews, observeAdminUsers, observeApplications, observeApprovedReviewPhotos, observeAuth, observeOpportunities, observeOrganizations,
  markNotificationRead, observeInvitations, observeNotifications, observeOrganizationProfile, observeReviews, observeVisibleVolunteerProfiles, observeVolunteerProfile, recordCompletedExperience, reportReview, saveOrganizationProfile,
  saveVolunteerProfile, updateApplicationStatus, updateInvitationStatus, updateOpportunity,
} from "@/lib/firebase-service";
import { isFirebaseConfigured } from "@/lib/firebase";
import { analyzeSemanticCompatibility } from "@/lib/ai-service";
import { recommendOpportunities } from "@/lib/recommendations";
import type { AppNotification, Application, Invitation, Opportunity, OpportunityStatus, Organization, PlatformUser, Review, ReviewPhoto, ReviewReport, SessionUser, VolunteerProfile } from "@/lib/types";

type Screen = "landing" | "opportunities" | "volunteer" | "organization" | "admin";

const DEMO_USERS = {
  volunteer: { uid: "demo-volunteer", email: "sofia@demo.local", displayName: "Sofía Martínez", role: "volunteer", isDemo: true } as SessionUser,
  organization: { uid: "demo-organization", email: "equipo@fundemos.demo", displayName: "Fundemos", role: "organization", isDemo: true } as SessionUser,
  admin: { uid: "demo-admin", email: "admin@prototipo.demo", displayName: "Tao · Administrador", role: "admin", isDemo: true } as SessionUser,
};

const DEMO_ORGANIZATION: Organization = {
  id: "fundemos", ownerId: "demo-organization", name: "Fundemos", email: "equipo@fundemos.demo",
  province: "Córdoba", location: "Córdoba capital", contact: "equipo@fundemos.demo",
  description: "Organización orientada a proyectos comunitarios, ambientales y educativos.", status: "verified",
};

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

function registerVerifiedSkills(current: Record<string, number>, skills: string[]) {
  return skills.reduce((levels, skill) => ({ ...levels, [skill]: (levels[skill] ?? 0) + 1 }), { ...current });
}

function screenForRole(role: SessionUser["role"]): Screen {
  if (role === "organization") return "organization";
  if (role === "admin") return "admin";
  return "volunteer";
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
    && organization.description.trim(),
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
  const [roleOpen, setRoleOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
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
  const [volunteers, setVolunteers] = useState<VolunteerProfile[]>(DEMO_VOLUNTEERS);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [viaPromptToken, setViaPromptToken] = useState(0);
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
    if (nextUser) setScreen(screenForRole(nextUser.role));
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
    if (item.read) return;
    setNotifications((current) => current.map((notification) => notification.id === item.id ? { ...notification, read: true } : notification));
    if (user && !user.isDemo) await markNotificationRead(item.id).catch(() => undefined);
  }

  const recommended = useMemo(
    () => recommendOpportunities(opportunities, user?.role === "volunteer" ? profile : null),
    [opportunities, profile, user?.role],
  );

  function navigate(next: Screen) {
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
    setRoleOpen(false);
    setScreen(screenForRole(nextUser.role));
    toast.success(`Entraste como ${nextUser.displayName}`);
  }

  function signOut() {
    // La interfaz sale de inmediato mientras Firebase limpia la sesión.
    void firebaseSignOut().catch(() => undefined);
    setUser(null);
    setProfileLoadedFor(null);
    setOrganizationLoadedFor(null);
    setOrganizationProfile(null);
    setScreen("landing");
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("red-cercana-theme", next);
  }

  async function apply(opportunity: Opportunity) {
    if (!user) { setSelectedOpportunity(null); setAuthOpen(true); return; }
    if (user.role !== "volunteer") return toast.info("Ingresá como voluntario para mostrar interés.");
    if (applications.some((item) => item.opportunityId === opportunity.id && item.userId === user.uid)) return toast.info("Ya mostraste interés en esta oportunidad.");
    const next: Application = {
      id: `${opportunity.id}_${user.uid}`, opportunityId: opportunity.id, opportunityTitle: opportunity.title,
      organizationId: opportunity.organizationId, userId: user.uid, userName: user.displayName,
      userEmail: user.email, message: "Me interesa participar.", status: "pending", createdAt: new Date().toISOString(),
    };
    try {
      if (!user.isDemo) await createApplication(opportunity, user);
      setApplications((current) => [...current, next]);
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
    const key = `voluntariando-tutorial-${user.uid}-${user.role}-v1`;
    if (window.localStorage.getItem(key)) return;
    const timer = window.setTimeout(() => setTutorialOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, [user, profile, profileLoadedFor, organizationProfile, organizationLoadedFor]);

  function finishTutorial(showVia: boolean) {
    if (user && !user.isDemo) window.localStorage.setItem(`voluntariando-tutorial-${user.uid}-${user.role}-v1`, "done");
    setTutorialOpen(false);
    if (showVia && user?.role === "volunteer") setViaPromptToken((current) => current + 1);
  }

  return (
    <main className="site-shell">
      <div className="ambient-background" aria-hidden="true"><span className="ambient-orb ambient-orb-one" /><span className="ambient-orb ambient-orb-two" /><span className="ambient-orb ambient-orb-three" /></div>
      {/* Los avisos aparecen debajo del encabezado para no bloquear la navegación. */}
      <Toaster position="top-center" offset={90} richColors />
      <SiteHeader screen={screen} user={user} notifications={notifications} onReadNotification={readNotification} onTutorial={() => setTutorialOpen(true)} onTheme={toggleTheme} onNavigate={navigate} onLogin={() => setAuthOpen(true)} onSwitchRole={() => setRoleOpen(true)} onSignOut={signOut} />
      <div className="screen-stage" key={screen}>
        {screen === "landing" && <Landing opportunities={opportunities} reviews={reviews} reviewPhotos={reviewPhotos} user={user} onExplore={() => navigate("opportunities")} onLogin={() => setAuthOpen(true)} />}
        {screen === "opportunities" && <OpportunityFeed opportunities={recommended} user={user} onOpen={setSelectedOpportunity} />}
        {screen === "volunteer" && user?.role === "volunteer" && !user.isDemo && profileLoadedFor !== user.uid && <ProfileLoading />}
        {screen === "volunteer" && user?.role === "volunteer" && (user.isDemo || profileLoadedFor === user.uid) && (
          <VolunteerPanel user={user} profile={profile} applications={applications} invitations={invitations} reviews={reviews} opportunities={recommended} onInvitations={setInvitations} onProfile={setProfile} onReview={(next) => setReviews((current) => [next, ...current.filter((item) => item.id !== next.id)])} onExplore={() => navigate("opportunities")} />
        )}
        {screen === "organization" && user?.role === "organization" && !user.isDemo && organizationLoadedFor !== user.uid && <ProfileLoading />}
        {screen === "organization" && user?.role === "organization" && (user.isDemo || organizationLoadedFor === user.uid) && (
          <OrganizationPanel
            user={user} organization={organization} opportunities={opportunities} applications={applications} invitations={invitations} volunteers={volunteers}
            onOrganization={(next) => setOrganizations((current) => [...current.filter((item) => item.id !== next.id), next])}
            onOpportunities={setOpportunities} onApplications={setApplications} onInvitations={setInvitations} onProfile={setProfile}
          />
        )}
        {screen === "admin" && user?.role === "admin" && <AdminPanel user={user} opportunities={opportunities} reviews={reviews} />}
      </div>
      <GuideAssistant user={user} profile={profile} opportunities={recommended} promptToken={viaPromptToken} onOpenOpportunity={setSelectedOpportunity} />
      <OpportunityDialog opportunity={selectedOpportunity} user={user} applications={applications} open={Boolean(selectedOpportunity)} onOpenChange={(open) => !open && setSelectedOpportunity(null)} onApply={apply} />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} onUser={loginAs} />
      <RoleSwitcher open={roleOpen} onOpenChange={setRoleOpen} onUser={loginAs} />
      {user?.role === "volunteer" && !user.isDemo && <VolunteerProfileDialog user={user} profile={profile} open={volunteerOnboarding} onOpenChange={() => undefined} onSaved={setProfile} mandatory />}
      {user?.role === "organization" && !user.isDemo && <OrganizationProfileDialog user={user} organization={organization} open={organizationOnboarding} onOpenChange={() => undefined} onSaved={(next) => { setOrganizationProfile(next); setOrganizations((current) => [...current.filter((item) => item.id !== next.id), next]); }} mandatory />}
      {user && user.role !== "admin" && <WelcomeTutorial role={user.role} open={tutorialOpen} onOpenChange={setTutorialOpen} onFinish={finishTutorial} />}
    </main>
  );
}

function ProfileLoading() {
  return <section className="profile-loading" role="status"><span className="profile-loading-mark"><Sparkles /></span><h1>Preparando tu espacio…</h1><p>Estamos cargando tu perfil de forma segura.</p></section>;
}

function SiteHeader({ screen, user, notifications, onReadNotification, onTutorial, onTheme, onNavigate, onLogin, onSwitchRole, onSignOut }: {
  screen: Screen; user: SessionUser | null; notifications: AppNotification[]; onReadNotification: (item: AppNotification) => void; onTutorial: () => void; onTheme: () => void; onNavigate: (screen: Screen) => void; onLogin: () => void; onSwitchRole: () => void; onSignOut: () => void;
}) {
  const account = user ? screenForRole(user.role) : "volunteer";
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const unread = notifications.filter((item) => !item.read).length;
  return <><header className="site-header">
    <button className="brand" onClick={() => onNavigate("landing")}><span className="brand-mark"><HeartHandshake /></span><span>VoluntarIAndo<small>encontrá dónde ayudar</small></span></button>
    <nav className="main-nav" aria-label="Navegación principal"><button className={screen === "landing" ? "active" : ""} onClick={() => onNavigate("landing")}>Inicio</button><button className={screen === "opportunities" ? "active" : ""} onClick={() => onNavigate("opportunities")}>Oportunidades</button>{user && <button className={screen === account ? "active" : ""} onClick={() => onNavigate(account)}>Mi espacio</button>}</nav>
    <div className="header-account"><Button className="theme-toggle" variant="ghost" size="icon" onClick={onTheme} aria-label="Cambiar tema de color"><Moon className="theme-icon-light" /><Sun className="theme-icon-dark" /></Button>{user ? <>{user.role !== "admin" && <button className="tutorial-button" onClick={onTutorial} aria-label="Abrir tutorial">?</button>}<button className="notification-button" onClick={() => setNotificationsOpen(true)} aria-label={`${unread} notificaciones sin leer`}><span aria-hidden="true">🔔</span>{unread > 0 && <b>{unread}</b>}</button><button className="account-chip" onClick={onSwitchRole} title="Cambiar rol"><span>{user.displayName.charAt(0)}</span><b>{user.displayName}</b><UserCog /></button><Button variant="ghost" size="icon" onClick={onSignOut} aria-label="Cerrar sesión"><LogOut /></Button></> : <Button className="soft-button" onClick={onLogin}>Ingresar</Button>}</div>
  </header><NotificationDialog notifications={notifications} open={notificationsOpen} onOpenChange={setNotificationsOpen} onRead={onReadNotification} /></>;
}

function NotificationDialog({ notifications, open, onOpenChange, onRead }: { notifications: AppNotification[]; open: boolean; onOpenChange: (open: boolean) => void; onRead: (item: AppNotification) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="notification-dialog"><DialogHeader><DialogTitle>Notificaciones</DialogTitle><DialogDescription>Solicitudes y respuestas de tus participaciones.</DialogDescription></DialogHeader><div className="notification-list">{notifications.map((item) => <button key={item.id} className={item.read ? "read" : ""} onClick={() => onRead(item)}><span>{item.type === "application_received" ? "👤" : item.type === "application_accepted" ? "✓" : "↪"}</span><div><b>{item.title}</b><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleDateString("es-AR")}</small></div>{!item.read && <i />}</button>)}{!notifications.length && <p className="panel-note">Todavía no tenés notificaciones.</p>}</div><DialogFooter><Button onClick={() => onOpenChange(false)}>Cerrar</Button></DialogFooter></DialogContent></Dialog>;
}

function WelcomeTutorial({ role, open, onOpenChange, onFinish }: { role: "volunteer" | "organization"; open: boolean; onOpenChange: (open: boolean) => void; onFinish: (showVia: boolean) => void }) {
  const [step, setStep] = useState(0);
  const steps = role === "volunteer" ? [
    { title: "Completá tu perfil", text: "Intereses, habilidades, disponibilidad y ubicación permiten calcular recomendaciones útiles." },
    { title: "Explorá oportunidades", text: "Usá la búsqueda, los filtros por provincia y modalidad o la vista de mapa." },
    { title: "Entendé la compatibilidad", text: "Cada porcentaje explica habilidades, intereses, disponibilidad, ubicación y experiencias relacionadas." },
    { title: "Mostrá interés", text: "La organización recibirá tu solicitud y podrás seguir su estado desde Mi espacio." },
    { title: "Construí tu trayectoria", text: "Cuando una experiencia se completa, sus tareas y habilidades verificadas mejoran futuras recomendaciones." },
  ] : [
    { title: "Configurá la organización", text: "Completá su descripción, ubicación y datos de contacto." },
    { title: "Publicá oportunidades", text: "Detallá tareas, habilidades, disponibilidad, modalidad y ubicación." },
    { title: "Consultá voluntarios", text: "Revisá perfiles visibles y las habilidades declaradas de cada persona." },
    { title: "Enviá invitaciones", text: "Elegí una oportunidad y enviá una propuesta personalizada. El match se crea cuando la aceptan." },
    { title: "Gestioná participaciones", text: "Confirmá solicitudes, marcá experiencias realizadas y registrá tareas y habilidades demostradas." },
  ];
  function changeOpen(nextOpen: boolean) { if (!nextOpen) setStep(0); onOpenChange(nextOpen); }
  const current = steps[step];
  const last = step === steps.length - 1;
  return <Dialog open={open} onOpenChange={changeOpen}><DialogContent className="tutorial-dialog" showCloseButton={false}><div className="tutorial-progress" aria-label={`Paso ${step + 1} de ${steps.length}`}>{steps.map((item, index) => <i key={item.title} className={index <= step ? "active" : ""} />)}</div><span className="tutorial-step">Paso {step + 1} de {steps.length}</span><DialogHeader><DialogTitle>{current.title}</DialogTitle><DialogDescription>{current.text}</DialogDescription></DialogHeader><div className="tutorial-illustration" aria-hidden="true">{role === "volunteer" ? <UserRound /> : <Building2 />}<Sparkles /></div><DialogFooter><Button variant="ghost" onClick={() => onFinish(false)}>Omitir tutorial</Button>{step > 0 && <Button variant="outline" onClick={() => setStep((value) => value - 1)}>Anterior</Button>}<Button onClick={() => last ? onFinish(role === "volunteer") : setStep((value) => value + 1)}>{last ? role === "volunteer" ? "Finalizar y abrir Vía" : "Finalizar" : "Siguiente"}</Button></DialogFooter></DialogContent></Dialog>;
}

function Landing({ opportunities, reviews, reviewPhotos, user, onExplore, onLogin }: { opportunities: Opportunity[]; reviews: Review[]; reviewPhotos: ReviewPhoto[]; user: SessionUser | null; onExplore: () => void; onLogin: () => void }) {
  const [guide, setGuide] = useState<number | null>(null);
  const [reportedReview, setReportedReview] = useState<Review | null>(null);
  const steps = [
    { title: "Creá tu perfil", text: "Registrá intereses, habilidades y ubicación.", videoSrc: "/videos/crear-perfil.mp4", posterSrc: "/videos/crear-perfil.png" },
    { title: "Recibí recomendaciones", text: "El sistema calcula y explica la compatibilidad.", videoSrc: "/videos/recibir-recomendaciones.mp4", posterSrc: "/videos/recibir-recomendaciones.png" },
    { title: "Mostrá interés", text: "La organización acepta o rechaza la solicitud.", videoSrc: "/videos/mostrar-interes.mp4", posterSrc: "/videos/mostrar-interes.png" },
    { title: "Sumá experiencia", text: "Las habilidades verificadas actualizan tu trayectoria.", videoSrc: "/videos/sumar-experiencia.mp4", posterSrc: "/videos/sumar-experiencia.png" },
  ];
  return <>
    <section className="hero-section document-hero">
      <div className="hero-copy"><Badge className="hero-kicker"><Sparkles /> Voluntariado que deja huella</Badge><h1>Conectamos personas que quieren ayudar con oportunidades de voluntariado.</h1><p>Descubrí, postuláte y construí una trayectoria que mejora tus próximas recomendaciones.</p><div className="hero-actions"><Button size="lg" onClick={onExplore}>Explorar oportunidades <ArrowRight /></Button><Button size="lg" variant="outline" onClick={onLogin}>Ingresar con Google</Button></div><span className="hero-note"><ShieldCheck /> Las oportunidades se pueden explorar sin iniciar sesión.</span></div>
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
  return <section className="feed-page"><div className="feed-intro"><div><span><Sparkles /> {user?.role === "volunteer" ? "Recomendaciones personalizadas" : "Oportunidades disponibles"}</span><h1>Encontrá dónde participar</h1><p>Ordenadas por compatibilidad cuando ingresás como voluntario.</p></div><Button variant="outline" onClick={() => setShowMap((value) => !value)}><Map /> {showMap ? "Ver listado" : "Ver mapa"}</Button></div>
    <div className="feed-search"><Search /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar oportunidades, organizaciones o temáticas" /></div>
    <div className="feed-layout document-feed"><aside className="filter-panel"><div className="aside-title"><b>Filtros</b></div><label>Provincia<Select value={province} onValueChange={setProvince}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{provinces.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></label><label>Modalidad<Select value={modality} onValueChange={setModality}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Todas", "Presencial", "Virtual", "Híbrida"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></label></aside>
      <div className="feed-main"><div className="feed-count"><b>{filtered.length} oportunidades</b><span>{user?.role === "volunteer" ? "mayor compatibilidad primero" : "disponibles"}</span></div>{showMap ? <OpportunityMap opportunities={filtered} selectedId={null} onSelect={(id) => { const item = filtered.find((candidate) => candidate.id === id); if (item) onOpen(item); }} /> : filtered.map((item) => <OpportunityCard key={item.id} item={item} personalized={user?.role === "volunteer"} onOpen={() => onOpen(item)} />)}</div>
    </div>
  </section>;
}

function OpportunityCard({ item, personalized, onOpen }: { item: Opportunity; personalized?: boolean; onOpen: () => void }) {
  return <article className="feed-opportunity-card"><div className="opportunity-photo" style={{ backgroundImage: `url(${item.imageUrl})` }}><Badge>{item.category}</Badge>{item.simulated && <SimulatedSeal />}</div><div className="opportunity-copy">{personalized && <div className="compatibility-row"><strong>{item.compatibility ?? 0}% compatible</strong><span><i style={{ width: `${item.compatibility ?? 0}%` }} /></span></div>}<div className="opportunity-heading"><div><h2>{item.title}</h2><p>{item.organization}</p></div></div><div className="opportunity-info"><span><CalendarDays /> {item.dateLabel}</span><span><Clock3 /> {item.time}</span><span><MapPin /> {item.neighborhood}</span><span>{item.modality ?? "Presencial"}</span></div><p className="opportunity-description">{item.description}</p>{personalized && <p className="recommendation-reason">{item.recommendedBecause}</p>}<footer><span><Users /> {item.availableSpots} lugares disponibles</span><Button size="sm" onClick={onOpen}>Ver detalle</Button></footer></div></article>;
}

function VolunteerPanel({ user, profile, applications, invitations, reviews, opportunities, onInvitations, onProfile, onReview, onExplore }: { user: SessionUser; profile: VolunteerProfile; applications: Application[]; invitations: Invitation[]; reviews: Review[]; opportunities: Opportunity[]; onInvitations: (items: Invitation[]) => void; onProfile: (profile: VolunteerProfile) => void; onReview: (review: Review) => void; onExplore: () => void }) {
  const [editOpen, setEditOpen] = useState(false);
  const [reviewApplication, setReviewApplication] = useState<Application | null>(null);
  async function respondToInvitation(item: Invitation, status: "accepted" | "rejected") {
    try {
      const next = user.isDemo ? { ...item, status } : await updateInvitationStatus(user, item, status);
      onInvitations(invitations.map((current) => current.id === next.id ? next : current));
      toast.success(status === "accepted" ? "Propuesta aceptada y match creado" : "Propuesta rechazada");
    } catch (error) { toast.error("No pudimos responder la propuesta", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); }
  }
  return <Dashboard title={`Hola, ${profile.name}`} description="Tu perfil y tu trayectoria determinan las recomendaciones." icon={<UserRound />} action={<Button onClick={() => setEditOpen(true)}><Pencil /> Editar perfil</Button>}>
    <div className="stats-grid"><Stat label="Experiencias" value={profile.completedExperiences} detail="completadas" /><Stat label="Intereses" value={profile.interests.length} detail="registrados" /><Stat label="Habilidades" value={(profile.declaredSkills ?? []).length} detail="declaradas" /><Stat label="Verificadas" value={Object.keys(profile.verifiedSkills ?? {}).length} detail="por organizaciones" /></div>
    <div className="dashboard-grid"><section className="panel-card wide-panel"><div className="panel-heading"><div><span>Opciones para vos</span><h2>Mayor compatibilidad</h2></div><Button variant="outline" onClick={onExplore}>Ver todas</Button></div><div className="mini-opportunity-grid">{opportunities.slice(0, 3).map((item) => <div key={item.id}><b>{item.compatibility ?? 0}%</b>{item.simulated && <SimulatedSeal />}<h3>{item.title}</h3><p>{item.recommendedBecause}</p></div>)}</div></section>
      <section className="panel-card"><div className="panel-heading"><div><span>Perfil</span><h2>Datos para el análisis</h2></div></div><Info label="Ubicación" value={profile.location} /><Info label="Intereses" value={profile.interests.join(", ") || "Sin completar"} /><Info label="Habilidades" value={(profile.declaredSkills ?? []).join(", ") || "Sin completar"} /><Info label="Disponibilidad" value={(profile.availability ?? []).join(", ") || "Sin completar"} />{Object.values(profile.socialLinks ?? {}).some(Boolean) && <div className="social-links">{profile.socialLinks?.instagram && <a href={profile.socialLinks.instagram} target="_blank" rel="noreferrer"><Globe2 /> Instagram</a>}{profile.socialLinks?.linkedin && <a href={profile.socialLinks.linkedin} target="_blank" rel="noreferrer"><Globe2 /> LinkedIn</a>}{profile.socialLinks?.other && <a href={profile.socialLinks.other} target="_blank" rel="noreferrer"><Globe2 /> Otra red</a>}</div>}</section>
      <section className="panel-card"><div className="panel-heading"><div><span>Propuestas</span><h2>Invitaciones de organizaciones</h2></div></div><div className="timeline-list">{invitations.map((item) => <div key={item.id}><span className="timeline-icon"><Building2 /></span><div><b>{item.opportunityTitle}</b><p>{item.organizationName} · {item.message}</p></div>{item.status === "pending" ? <span className="inline-actions"><Button size="sm" onClick={() => void respondToInvitation(item, "accepted")}>Aceptar</Button><Button size="sm" variant="outline" onClick={() => void respondToInvitation(item, "rejected")}>Rechazar</Button></span> : <Badge variant="secondary">{item.status === "accepted" ? "Aceptada" : "Rechazada"}</Badge>}</div>)}{!invitations.length && <p className="panel-note">Las propuestas directas aparecerán acá.</p>}</div></section>
      <section className="panel-card"><div className="panel-heading"><div><span>Solicitudes</span><h2>Estado de tus postulaciones</h2></div></div><div className="timeline-list">{applications.filter((item) => item.userId === user.uid || user.isDemo).map((item) => { const reviewed = reviews.some((review) => review.applicationId === item.id); return <div key={item.id}><span className="timeline-icon"><Check /></span><div><b>{item.opportunityTitle}</b><p>{item.completedAt ? "Experiencia completada" : item.status === "accepted" ? "Participación confirmada" : item.status === "rejected" ? "Solicitud rechazada" : "Pendiente de respuesta"}</p></div>{item.completedAt ? <Button size="sm" variant="outline" disabled={reviewed} onClick={() => setReviewApplication(item)}>{reviewed ? "Reseñada" : "Escribir reseña"}</Button> : <Badge variant="secondary">{item.status}</Badge>}</div>; })}</div></section>
      <section className="panel-card wide-panel"><div className="panel-heading"><div><span>Trayectoria</span><h2>Habilidades verificadas</h2></div></div><p className="panel-note">Una habilidad aparece cuando una organización la registra en una experiencia completada.</p><div className="verified-skill-list">{Object.keys(profile.verifiedSkills ?? {}).filter((skill) => (profile.verifiedSkills?.[skill] ?? 0) > 0).map((skill) => <span key={skill}><Check /> {skill}</span>)}{!Object.values(profile.verifiedSkills ?? {}).some((count) => count > 0) && <p className="featured-empty">Todavía no hay habilidades verificadas.</p>}</div></section>
      <section className="panel-card wide-panel"><div className="panel-heading"><div><span>Trayectoria</span><h2>Experiencias verificadas</h2></div></div><div className="timeline-list">{(profile.experiences ?? []).length ? profile.experiences!.map((item) => <div key={`${item.opportunityId}-${item.completedAt}`}><span className="timeline-icon"><Check /></span><div><b>{item.opportunityTitle}</b><p>{item.organization} · {item.tasks.join(", ")}</p><small>Habilidades observadas: {item.skills.join(", ")}</small></div></div>) : <p className="panel-note">Las experiencias completadas aparecerán acá.</p>}</div></section>
    </div><VolunteerProfileDialog user={user} profile={profile} open={editOpen} onOpenChange={setEditOpen} onSaved={onProfile} /><ReviewDialog user={user} application={reviewApplication} organizationName={opportunities.find((item) => item.id === reviewApplication?.opportunityId)?.organization ?? "Organización participante"} open={Boolean(reviewApplication)} onOpenChange={(nextOpen) => !nextOpen && setReviewApplication(null)} onSaved={onReview} />
  </Dashboard>;
}

function OrganizationPanel({ user, organization, opportunities, applications, invitations, volunteers, onOrganization, onOpportunities, onApplications, onInvitations, onProfile }: { user: SessionUser; organization: Organization; opportunities: Opportunity[]; applications: Application[]; invitations: Invitation[]; volunteers: VolunteerProfile[]; onOrganization: (organization: Organization) => void; onOpportunities: (items: Opportunity[]) => void; onApplications: (items: Application[]) => void; onInvitations: (items: Invitation[]) => void; onProfile: (profile: VolunteerProfile) => void }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [opportunityOpen, setOpportunityOpen] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [experience, setExperience] = useState<Application | null>(null);
  const [invitedVolunteer, setInvitedVolunteer] = useState<VolunteerProfile | null>(null);
  const own = opportunities.filter((item) => item.organizationId === organization.id || (user.isDemo && item.organizationId === "fundemos"));
  const requests = applications.filter((item) => own.some((opportunity) => opportunity.id === item.opportunityId) || user.isDemo);
  async function decide(item: Application, status: "accepted" | "rejected") {
    try {
      if (!user.isDemo) await updateApplicationStatus(item, status);
      onApplications(applications.map((current) => current.id === item.id ? { ...current, status } : current));
      toast.success(status === "accepted" ? "Participación confirmada" : "Solicitud rechazada");
    } catch (error) { toast.error("No pudimos actualizar la solicitud", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); }
  }
  function invitationAsApplication(item: Invitation): Application {
    return {
      id: item.id, opportunityId: item.opportunityId, opportunityTitle: item.opportunityTitle,
      organizationId: item.organizationId, userId: item.userId, userName: item.userName,
      userEmail: "", message: item.message, status: "accepted", createdAt: item.createdAt,
      completedAt: item.completedAt, source: "invitation", matchId: `invitation_${item.id}`,
    };
  }
  return <Dashboard title={organization.name} description="Gestioná el perfil, las oportunidades y las participaciones." icon={<Building2 />} action={<Button onClick={() => { setEditing(null); setOpportunityOpen(true); }}><Plus /> Nueva oportunidad</Button>}>
    <div className="stats-grid"><Stat label="Oportunidades" value={own.length} detail="publicadas" /><Stat label="Interesados" value={requests.filter((item) => item.status === "pending").length} detail="pendientes" /><Stat label="Confirmados" value={requests.filter((item) => item.status === "accepted" && !item.completedAt).length} detail="participaciones" /><Stat label="Completadas" value={requests.filter((item) => item.completedAt).length} detail="experiencias" /></div>
    <div className="dashboard-grid"><section className="panel-card wide-panel"><div className="panel-heading"><div><span>Perfil</span><h2>Información de la organización</h2></div><Button variant="outline" onClick={() => setProfileOpen(true)}><Pencil /> Editar</Button></div><p>{organization.description}</p><Info label="Ubicación" value={organization.location ?? organization.province} /><Info label="Contacto" value={organization.contact ?? organization.email} /></section>
      <section className="panel-card wide-panel"><div className="panel-heading"><div><span>Publicaciones</span><h2>Oportunidades</h2></div></div><div className="timeline-list">{own.map((item) => <div key={item.id}><span className="timeline-icon"><CalendarDays /></span><div><b>{item.title}</b><p>{item.modality ?? "Presencial"} · {(item.availability ?? []).join(", ")}</p></div><Button size="sm" variant="outline" onClick={() => { setEditing(item); setOpportunityOpen(true); }}>Editar</Button></div>)}</div></section>
      <section className="panel-card wide-panel"><div className="panel-heading"><div><span>Vinculación</span><h2>Solicitudes de participación</h2></div></div><div className="timeline-list">{requests.map((item) => <div key={item.id}><span className="profile-avatar">{item.userName.charAt(0)}</span><div><b>{item.userName}</b><p>{item.opportunityTitle} · {item.status}</p></div>{item.status === "pending" ? <span className="inline-actions"><Button size="sm" onClick={() => void decide(item, "accepted")}>Aceptar</Button><Button size="sm" variant="outline" onClick={() => void decide(item, "rejected")}>Rechazar</Button></span> : item.status === "accepted" && !item.completedAt ? <Button size="sm" onClick={() => setExperience(item)}>Marcar realizada</Button> : <Badge variant="secondary">{item.completedAt ? "Completada" : item.status}</Badge>}</div>)}</div></section>
      <section className="panel-card wide-panel"><div className="panel-heading"><div><span>Descubrir personas</span><h2>Voluntarios disponibles</h2></div></div><div className="volunteer-card-grid">{volunteers.map((volunteer) => { const pending = invitations.some((item) => item.userId === volunteer.id && item.status === "pending"); return <article key={volunteer.id}><span className="profile-avatar">{volunteer.initials}</span><div><b>{volunteer.name}</b><p>{volunteer.location}</p><small>{(volunteer.declaredSkills ?? []).slice(0, 3).join(" · ") || "Perfil en formación"}</small></div><Button size="sm" variant="outline" disabled={pending || !own.length} onClick={() => setInvitedVolunteer(volunteer)}>{pending ? "Invitación enviada" : "Invitar"}</Button></article>; })}{!volunteers.length && <p className="panel-note">Todavía no hay perfiles disponibles para organizaciones.</p>}</div></section>
      <section className="panel-card wide-panel"><div className="panel-heading"><div><span>Propuestas directas</span><h2>Estado de invitaciones</h2></div></div><div className="timeline-list">{invitations.map((item) => <div key={item.id}><span className="profile-avatar">{item.userName.charAt(0)}</span><div><b>{item.userName}</b><p>{item.opportunityTitle} · {item.completedAt ? "experiencia completada" : item.status === "accepted" ? "invitación aceptada" : item.status === "rejected" ? "invitación rechazada" : "esperando respuesta"}</p></div>{item.status === "accepted" && !item.completedAt ? <Button size="sm" onClick={() => setExperience(invitationAsApplication(item))}>Marcar realizada</Button> : <Badge variant="secondary">{item.completedAt ? "Completada" : item.status}</Badge>}</div>)}{!invitations.length && <p className="panel-note">Las invitaciones enviadas aparecerán acá.</p>}</div></section>
    </div>
    <OrganizationProfileDialog user={user} organization={organization} open={profileOpen} onOpenChange={setProfileOpen} onSaved={onOrganization} />
    <OpportunityEditor user={user} organization={organization} opportunity={editing} open={opportunityOpen} onOpenChange={setOpportunityOpen} onSaved={(next) => onOpportunities(editing ? opportunities.map((item) => item.id === next.id ? next : item) : [next, ...opportunities])} />
    <InvitationDialog user={user} organization={organization} volunteer={invitedVolunteer} opportunities={own} open={Boolean(invitedVolunteer)} onOpenChange={(open) => !open && setInvitedVolunteer(null)} onSaved={(next) => onInvitations([next, ...invitations.filter((item) => item.id !== next.id)])} />
    <ExperienceDialog user={user} organization={organization} application={experience} open={Boolean(experience)} onOpenChange={(open) => !open && setExperience(null)} onCompleted={(next, skills, tasks) => { if (next.source === "invitation") onInvitations(invitations.map((item) => item.id === next.id ? { ...item, completedAt: next.completedAt } : item)); else onApplications(applications.map((item) => item.id === next.id ? next : item)); onProfile({ ...DEMO_VOLUNTEERS[0], completedExperiences: DEMO_VOLUNTEERS[0].completedExperiences + 1, verifiedSkills: registerVerifiedSkills(DEMO_VOLUNTEERS[0].verifiedSkills ?? {}, skills), experiences: [...(DEMO_VOLUNTEERS[0].experiences ?? []), { opportunityId: next.opportunityId, opportunityTitle: next.opportunityTitle, organization: organization.name, tasks, skills, completedAt: new Date().toISOString() }] }); }} />
  </Dashboard>;
}

function AdminPanel({ user, opportunities, reviews }: { user: SessionUser; opportunities: Opportunity[]; reviews: Review[] }) {
  const demoUsers = Object.values(DEMO_USERS) as PlatformUser[];
  const [managedUsers, setManagedUsers] = useState<PlatformUser[]>(demoUsers);
  const [managedOpportunities, setManagedOpportunities] = useState<Opportunity[]>(opportunities);
  const [managedReviews, setManagedReviews] = useState<Review[]>(reviews);
  const [reviewReports, setReviewReports] = useState<ReviewReport[]>(DEMO_REVIEW_REPORTS);
  const [reviewPhotos, setReviewPhotos] = useState<ReviewPhoto[]>([]);
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReviewReport | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<ReviewPhoto | null>(null);

  useEffect(() => {
    if (user.isDemo) return;
    const fail = (error: Error) => toast.error("No se pudo cargar administración", { description: error.message });
    const stops = [
      observeAdminUsers(setManagedUsers, fail),
      observeAdminOpportunities(setManagedOpportunities, fail),
      observeAdminReviews(setManagedReviews, fail),
      observeAdminReviewReports(setReviewReports, fail),
      observeAdminReviewPhotos(setReviewPhotos, fail),
    ];
    return () => stops.forEach((stop) => stop());
  }, [user.isDemo]);

  return <Dashboard title="Administración" description="Supervisión general, moderación y corrección de la plataforma." icon={<Shield />} action={<Badge variant="secondary">{user.isDemo ? "Modo demostración" : "Firebase activo"}</Badge>}>
    <div className="stats-grid"><Stat label="Usuarios" value={managedUsers.length} detail="cuentas registradas" /><Stat label="Suspendidos" value={managedUsers.filter((item) => item.status === "suspended").length} detail="cuentas restringidas" /><Stat label="Oportunidades" value={managedOpportunities.length} detail="totales" /><Stat label="Por revisar" value={reviewReports.filter((item) => item.status === "pending").length + reviewPhotos.filter((item) => item.status === "pending").length} detail="denuncias y fotos" /></div>
    <div className="dashboard-grid admin-grid">
      <section className="panel-card wide-panel"><div className="panel-heading"><div><span>Control de usuarios</span><h2>Perfiles, roles y contacto</h2></div></div><div className="admin-list">{managedUsers.map((item) => <div key={item.uid}><span className="admin-icon green">{item.role === "organization" ? <Building2 /> : item.role === "admin" ? <Shield /> : <UserRound />}</span><div><b>{item.displayName}</b><p>{item.email} · {item.role} · {item.status === "suspended" ? "suspendido" : "activo"}</p>{item.suspensionReason && <small>Motivo: {item.suspensionReason}</small>}</div><span className="inline-actions"><Badge variant={item.status === "suspended" ? "destructive" : "secondary"}>{item.status === "suspended" ? "Suspendido" : "Activo"}</Badge><Button size="sm" variant="outline" onClick={() => setSelectedUser(item)} disabled={item.uid === user.uid}><Settings2 /> Gestionar</Button></span></div>)}</div></section>
      <section className="panel-card wide-panel"><div className="panel-heading"><div><span>Moderación</span><h2>Oportunidades</h2></div></div><div className="admin-list">{managedOpportunities.map((item) => <div key={item.id}><span className={`admin-icon ${item.status === "published" ? "green" : "amber"}`}>{item.status === "published" ? <ShieldCheck /> : <Ban />}</span><div><b>{item.title}</b><p>{item.organization} · {item.province} · {item.status === "published" ? "visible" : "oculta"}</p>{item.moderationReason && <small>Último motivo: {item.moderationReason}</small>}</div><Button size="sm" variant="outline" onClick={() => setSelectedOpportunity(item)}><Pencil /> Corregir</Button></div>)}</div></section>
      <section className="panel-card wide-panel"><div className="panel-heading"><div><span>Reseñas</span><h2>Denuncias pendientes</h2></div></div><div className="admin-list">{reviewReports.filter((item) => item.status === "pending").map((report) => { const review = managedReviews.find((item) => item.id === report.reviewId); return <div key={report.id}><span className="admin-icon amber"><Ban /></span><div><b>{review?.opportunityTitle ?? "Reseña"}</b><p>{report.reason}</p><small>{review?.authorName} · {review?.rating ?? 0} estrellas</small></div><Button size="sm" variant="outline" onClick={() => setSelectedReport(report)}>Revisar</Button></div>; })}{!reviewReports.some((item) => item.status === "pending") && <p className="panel-note">No hay denuncias pendientes.</p>}</div></section>
      <section className="panel-card wide-panel"><div className="panel-heading"><div><span>Fotografías</span><h2>Aprobación previa</h2></div></div><div className="admin-list">{reviewPhotos.filter((item) => item.status === "pending").map((photo) => { const review = managedReviews.find((item) => item.id === photo.reviewId); return <div key={photo.id}><Image className="admin-review-photo" src={photo.imageDataUrl} alt="Fotografía pendiente" width={88} height={64} unoptimized /><div><b>{review?.opportunityTitle ?? "Foto de reseña"}</b><p>{review?.authorName ?? "Persona voluntaria"}</p><small>La reseña ya está publicada; esta imagen aún no.</small></div><Button size="sm" variant="outline" onClick={() => setSelectedPhoto(photo)}>Revisar</Button></div>; })}{!reviewPhotos.some((item) => item.status === "pending") && <p className="panel-note">No hay fotografías pendientes.</p>}</div></section>
      <section className="panel-card wide-panel"><div className="panel-heading"><div><span>Trazabilidad</span><h2>Cómo funciona la intervención</h2></div></div><p className="panel-note">Las eliminaciones son reversibles: una oportunidad se cierra y una cuenta se suspende por un plazo definido. Cada cambio registra administrador, objetivo, motivo y fecha en <b>adminActions</b>.</p></section>
    </div>
    <AdminUserDialog key={selectedUser?.uid ?? "no-user"} actor={user} target={selectedUser} open={Boolean(selectedUser)} onOpenChange={(open) => !open && setSelectedUser(null)} onSaved={(next) => setManagedUsers((items) => items.map((item) => item.uid === next.uid ? next : item))} />
    <AdminOpportunityDialog key={selectedOpportunity?.id ?? "no-opportunity"} actor={user} target={selectedOpportunity} open={Boolean(selectedOpportunity)} onOpenChange={(open) => !open && setSelectedOpportunity(null)} onSaved={(next) => setManagedOpportunities((items) => items.map((item) => item.id === next.id ? next : item))} />
    <AdminReviewDialog actor={user} report={selectedReport} review={managedReviews.find((item) => item.id === selectedReport?.reviewId) ?? null} open={Boolean(selectedReport)} onOpenChange={(open) => !open && setSelectedReport(null)} onSaved={(nextReview, nextReport) => { setManagedReviews((items) => items.map((item) => item.id === nextReview.id ? nextReview : item)); setReviewReports((items) => items.map((item) => item.id === nextReport.id ? nextReport : item)); }} />
    <AdminReviewPhotoDialog actor={user} photo={selectedPhoto} review={managedReviews.find((item) => item.id === selectedPhoto?.reviewId) ?? null} open={Boolean(selectedPhoto)} onOpenChange={(open) => !open && setSelectedPhoto(null)} onSaved={(next) => setReviewPhotos((items) => items.map((item) => item.id === next.id ? next : item))} />
  </Dashboard>;
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
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>Gestionar cuenta</DialogTitle><DialogDescription>{target.email} · {target.role}</DialogDescription></DialogHeader><form className="create-form" onSubmit={submit}><label className="full">Nombre visible<Input name="displayName" defaultValue={target.displayName} required /></label><label>Rol<Select name="role" defaultValue={target.role}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="volunteer">Voluntario</SelectItem><SelectItem value="organization">Organización</SelectItem><SelectItem value="admin">Administrador</SelectItem></SelectContent></Select></label><label>Estado<Select name="status" defaultValue={target.status ?? "active"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Activa</SelectItem><SelectItem value="suspended">Suspendida</SelectItem></SelectContent></Select></label><label>Días de suspensión<Input type="number" name="days" min="1" max="365" defaultValue="7" /></label><label>Motivo<Input name="reason" defaultValue={target.suspensionReason ?? "Corrección administrativa"} required /></label><DialogFooter className="full"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Aplicar cambio"}</Button></DialogFooter></form></DialogContent></Dialog>;
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
  const verifiedCount = Object.keys(profile.verifiedSkills ?? {}).length;
  const explanation = goal === "aprender"
    ? "Suma tareas y habilidades que pueden ampliar tu trayectoria."
    : goal === "comunidad"
      ? "Prioriza una propuesta con impacto comunitario directo."
      : "Aprovecha coincidencias con habilidades y experiencias de tu perfil.";

  function closeAssistant() {
    setOpen(false);
    setStage("invite");
  }

  async function analyze() {
    setAiExplanation("");
    setStage("result");
    if (!user || user.isDemo || !suggested) return;
    setAnalyzing(true);
    try {
      const result = await analyzeSemanticCompatibility(profile, suggested);
      setAiExplanation(result.explanation);
    } catch {
      // Si la Function no está desplegada, Vía conserva la explicación reproducible del motor local.
    } finally { setAnalyzing(false); }
  }

  return <aside className={`guide-assistant ${open ? "open" : ""}`}>
    {open && <div className="assistant-panel">
      <header><Image src="/via-mecha.png" width={76} height={70} alt="Vía, camaleón mecha orientador" /><div><b>Vía</b><small>Motor de compatibilidad + análisis semántico opcional</small></div><button className="assistant-close" onClick={closeAssistant} aria-label="Cerrar a Vía">×</button></header>
      {stage === "invite" && <div className="assistant-invite"><p><b>¿Todavía no decidís dónde podés ayudar?</b> Te hago unas preguntas y buscamos una oportunidad para vos.</p><Button size="sm" onClick={() => setStage("questions")}>Sí, orientame <Sparkles /></Button><button onClick={closeAssistant}>Ahora no</button></div>}
      {stage === "questions" && <div className="assistant-questions"><p>{user?.role === "volunteer" ? `Hola, ${profile.name.split(" ")[0]}. Voy a combinar tus respuestas con ${profile.completedExperiences} experiencias y ${verifiedCount} habilidades verificadas.` : "Voy a usar tus respuestas y las métricas disponibles de cada oportunidad."}</p><label>¿Qué buscás?<Select value={goal} onValueChange={setGoal}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="aprender">Aprender algo nuevo</SelectItem><SelectItem value="comunidad">Ayudar a mi comunidad</SelectItem><SelectItem value="experiencia">Fortalecer mi perfil</SelectItem></SelectContent></Select></label><label>¿Qué causa te interesa más?<Select value={cause} onValueChange={setCause}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cualquiera">Quiero descubrir</SelectItem><SelectItem value="arte">Arte y creatividad</SelectItem><SelectItem value="ambiente">Ambiente</SelectItem><SelectItem value="educación">Educación</SelectItem><SelectItem value="comunidad">Comunidad</SelectItem></SelectContent></Select></label><label>¿Qué modalidad preferís?<Select value={format} onValueChange={setFormat}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cualquiera">Cualquiera</SelectItem><SelectItem value="presencial">Presencial</SelectItem><SelectItem value="virtual">Virtual</SelectItem><SelectItem value="híbrida">Híbrida</SelectItem></SelectContent></Select></label><Button size="sm" onClick={() => void analyze()}>Analizar opciones <Bot /></Button></div>}
      {stage === "result" && suggested && <div className="assistant-recommendation"><span className="assistant-score">{suggested.compatibility ?? 82}%</span><p>La mejor opción que encontré para vos es:</p><button className="assistant-result" onClick={() => { onOpenOpportunity(suggested); closeAssistant(); }}><Sparkles /><span><small>Recomendación de Vía</small><b>{suggested.title}</b><em>{analyzing ? "Buscando relaciones semánticas…" : aiExplanation || suggested.recommendedBecause || explanation}</em></span><ChevronRight /></button><button className="assistant-restart" onClick={() => setStage("questions")}>Cambiar mis respuestas</button></div>}
    </div>}
    <button className="assistant-launcher" onClick={() => setOpen((value) => !value)} aria-label="Abrir a Vía, asistente orientador"><Image src="/via-mecha.png" width={58} height={58} alt="" priority /><b>¿Todavía no decidís dónde ayudar?</b></button>
  </aside>;
}

function RoleSwitcher({ open, onOpenChange, onUser }: { open: boolean; onOpenChange: (open: boolean) => void; onUser: (user: SessionUser) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="auth-dialog"><DialogHeader><DialogTitle>Probar los tres caminos</DialogTitle><DialogDescription>Este selector es exclusivo del prototipo y permite recorrer cada rol sin salir.</DialogDescription></DialogHeader><div className="demo-role-grid"><button onClick={() => onUser(DEMO_USERS.volunteer)}><UserRound /><span><b>Voluntario</b><small>Perfil, postulaciones y recomendaciones</small></span></button><button onClick={() => onUser(DEMO_USERS.organization)}><Building2 /><span><b>Organización</b><small>Publicaciones, solicitudes y devoluciones</small></span></button><button onClick={() => onUser(DEMO_USERS.admin)}><Shield /><span><b>Administrador</b><small>Supervisión, corrección y moderación</small></span></button></div></DialogContent></Dialog>;
}

function Dashboard({ title, description, icon, action, children }: { title: string; description: string; icon: React.ReactNode; action: React.ReactNode; children: React.ReactNode }) {
  return <section className="dashboard-page"><div className="dashboard-hero"><span className="dashboard-icon">{icon}</span><div><span>Espacio de trabajo</span><h1>{title}</h1><p>{description}</p></div><div>{action}</div></div><div className="dashboard-body">{children}</div></section>;
}

function Stat({ label, value, detail }: { label: string; value: number; detail: string }) { return <article className="stat-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="profile-info-row"><small>{label}</small><b>{value}</b></div>; }

function OpportunityDialog({ opportunity, user, applications, open, onOpenChange, onApply }: { opportunity: Opportunity | null; user: SessionUser | null; applications: Application[]; open: boolean; onOpenChange: (open: boolean) => void; onApply: (item: Opportunity) => void }) {
  if (!opportunity) return null;
  const applied = Boolean(user && applications.some((item) => item.opportunityId === opportunity.id && item.userId === user.uid));
  const breakdown = opportunity.compatibilityBreakdown;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="opportunity-dialog"><div className="dialog-cover" style={{ backgroundImage: `url(${opportunity.imageUrl})` }}><Badge>{opportunity.category}</Badge>{opportunity.simulated && <SimulatedSeal />}</div><DialogHeader><DialogTitle>{opportunity.title}</DialogTitle><DialogDescription>{opportunity.organization}</DialogDescription></DialogHeader>{opportunity.compatibility !== undefined && <div className="compatibility-detail"><strong>{opportunity.compatibility}% de compatibilidad</strong>{breakdown && <div>{Object.entries(breakdown).map(([key, value]) => <span key={key}>{({ skills: "Habilidades", interests: "Intereses", availability: "Disponibilidad", location: "Ubicación/modalidad", experience: "Experiencias" } as Record<string, string>)[key]}: {value}%</span>)}</div>}<p>{opportunity.recommendedBecause}</p></div>}<div className="dialog-facts"><span><CalendarDays /> {opportunity.dateLabel}</span><span><Clock3 /> {opportunity.time}</span><span><MapPin /> {opportunity.neighborhood}</span><span>{opportunity.modality ?? "Presencial"}</span></div><p className="dialog-description">{opportunity.description}</p><div className="dialog-columns"><section><h3>Tareas</h3>{opportunity.tasks.map((item) => <p key={item}><Check /> {item}</p>)}</section><section><h3>Habilidades requeridas</h3>{(opportunity.requiredSkills ?? opportunity.requirements).map((item) => <p key={item}><Check /> {item}</p>)}</section></div><p className="privacy-note"><MapPin /><span><b>Ubicación</b>{opportunity.addressHint}</span></p><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button><Button disabled={applied || user?.role === "organization"} onClick={() => onApply(opportunity)}>{applied ? "Interés registrado" : "Me interesa"}</Button></DialogFooter></DialogContent></Dialog>;
}

function AuthDialog({ open, onOpenChange, onUser }: { open: boolean; onOpenChange: (open: boolean) => void; onUser: (user: SessionUser) => void }) {
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);
  async function login(role: SessionUser["role"]) { setLoading(true); try { const next = await firebaseSignInWithGoogle(role); onUser(next); } catch (error) { toast.error("No pudimos iniciar sesión", { description: authErrorMessage(error) }); } finally { setLoading(false); } }
  function changeOpen(nextOpen: boolean) { if (!nextOpen) setConsent(false); onOpenChange(nextOpen); }
  return <Dialog open={open} onOpenChange={changeOpen}><DialogContent className="auth-dialog"><DialogHeader><span className="auth-mark"><HeartHandshake /></span><DialogTitle>Ingresá con Google</DialogTitle><DialogDescription>En el primer acceso elegí el perfil que vas a utilizar.</DialogDescription></DialogHeader><label className="consent-box"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span><b>Consentimiento para la prueba</b>Entiendo que se guardarán mi nombre, correo y los datos que complete en mi perfil exclusivamente para probar el prototipo de la tesis.</span></label><Button variant="outline" onClick={() => void login("volunteer")} disabled={loading || !consent}><UserRound /> Continuar como voluntario</Button><Button variant="outline" onClick={() => void login("organization")} disabled={loading || !consent}><Building2 /> Continuar como organización</Button><Button variant="outline" onClick={() => void login("admin")} disabled={loading || !consent}><Shield /> Acceso de administrador</Button><p className="demo-hint">Recorré el prototipo sin crear datos reales y cambiá de rol cuando quieras:</p><div className="demo-role-grid"><button onClick={() => onUser(DEMO_USERS.volunteer)}><UserRound /><span><b>Voluntario demo</b><small>Perfil y recomendaciones</small></span></button><button onClick={() => onUser(DEMO_USERS.organization)}><Building2 /><span><b>Organización demo</b><small>Oportunidades y solicitudes</small></span></button><button onClick={() => onUser(DEMO_USERS.admin)}><Shield /><span><b>Administrador demo</b><small>Supervisión y moderación</small></span></button></div></DialogContent></Dialog>;
}

function VolunteerProfileDialog({ user, profile, open, onOpenChange, onSaved, mandatory = false }: { user: SessionUser; profile: VolunteerProfile; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (profile: VolunteerProfile) => void; mandatory?: boolean }) {
  function normalizeUrl(value: FormDataEntryValue | null) { const clean = String(value ?? "").trim(); if (!clean) return ""; return clean.startsWith("http://") || clean.startsWith("https://") ? clean : `https://${clean}`; }
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const socialLinks = { instagram: normalizeUrl(form.get("instagram")), linkedin: normalizeUrl(form.get("linkedin")), other: normalizeUrl(form.get("other")) }; const next = { ...profile, name: String(form.get("name")), location: String(form.get("location")), bio: String(form.get("bio")), interests: splitList(form.get("interests")), declaredSkills: splitList(form.get("skills")), availability: splitList(form.get("availability")), socialLinks }; if (!next.name || !next.location || !next.interests.length || !next.declaredSkills.length || !next.availability.length) return toast.error("Completá nombre, ubicación, intereses, habilidades y disponibilidad."); try { Object.values(socialLinks).filter(Boolean).forEach((value) => new URL(value)); } catch { return toast.error("Revisá los enlaces de tus redes sociales."); } try { if (!user.isDemo) await saveVolunteerProfile(next); onSaved(next); onOpenChange(false); toast.success("Perfil actualizado"); } catch (error) { toast.error("No pudimos guardar", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); } }
  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!mandatory || nextOpen) onOpenChange(nextOpen); }}><DialogContent className="create-dialog" showCloseButton={!mandatory} onEscapeKeyDown={mandatory ? (event) => event.preventDefault() : undefined} onPointerDownOutside={mandatory ? (event) => event.preventDefault() : undefined}><DialogHeader><DialogTitle>{mandatory ? "Completá tu perfil para continuar" : "Configurar perfil"}</DialogTitle><DialogDescription>{mandatory ? "Necesitamos estos datos para recomendarte oportunidades acordes a vos." : "Estos datos se utilizan para calcular la compatibilidad."}</DialogDescription></DialogHeader><form className="create-form" onSubmit={submit}><label>Nombre<Input name="name" defaultValue={profile.name} required /></label><label>Ubicación<Input name="location" defaultValue={profile.location} required /></label><label className="full">Sobre mí<Textarea name="bio" defaultValue={profile.bio} /></label><label className="full">Intereses separados por coma<Input name="interests" defaultValue={profile.interests.join(", ")} placeholder="Ambiente, educación, comunidad" required /></label><label className="full">Habilidades separadas por coma<Input name="skills" defaultValue={(profile.declaredSkills ?? []).join(", ")} placeholder="Trabajo en equipo, creatividad" required /></label><label className="full">Disponibilidad separada por coma<Input name="availability" defaultValue={(profile.availability ?? []).join(", ")} placeholder="Sábado por la mañana" required /></label><div className="form-divider full"><b>Redes sociales opcionales</b><small>Solo se mostrarán los enlaces que decidas completar.</small></div><label>Instagram<Input name="instagram" defaultValue={profile.socialLinks?.instagram} placeholder="instagram.com/usuario" /></label><label>LinkedIn<Input name="linkedin" defaultValue={profile.socialLinks?.linkedin} placeholder="linkedin.com/in/usuario" /></label><label className="full">Otra red o sitio<Input name="other" defaultValue={profile.socialLinks?.other} placeholder="https://..." /></label><DialogFooter className="full">{!mandatory && <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>}<Button type="submit">{mandatory ? "Guardar y entrar" : "Guardar perfil"}</Button></DialogFooter></form></DialogContent></Dialog>;
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
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const next = { ...organization, name: String(form.get("name")), description: String(form.get("description")), location: String(form.get("location")), province: String(form.get("province")), contact: String(form.get("contact")) }; if (!next.name || !next.description || !next.location || !next.contact) return toast.error("Completá todos los campos obligatorios."); try { if (!user.isDemo) await saveOrganizationProfile(next); onSaved(next); onOpenChange(false); toast.success("Perfil actualizado"); } catch (error) { toast.error("No pudimos guardar", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); } }
  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!mandatory || nextOpen) onOpenChange(nextOpen); }}><DialogContent className="create-dialog" showCloseButton={!mandatory} onEscapeKeyDown={mandatory ? (event) => event.preventDefault() : undefined} onPointerDownOutside={mandatory ? (event) => event.preventDefault() : undefined}><DialogHeader><DialogTitle>{mandatory ? "Completá la organización para continuar" : "Perfil de la organización"}</DialogTitle><DialogDescription>{mandatory ? "Esta información es necesaria antes de publicar oportunidades o recibir solicitudes." : "Información principal y de contacto."}</DialogDescription></DialogHeader><form className="create-form" onSubmit={submit}><label>Nombre<Input name="name" defaultValue={organization.name} required /></label><label>Provincia<Input name="province" defaultValue={organization.province} required /></label><label className="full">Descripción<Textarea name="description" defaultValue={organization.description} required /></label><label>Ubicación<Input name="location" defaultValue={organization.location} required /></label><label>Contacto<Input name="contact" defaultValue={organization.contact} required /></label><DialogFooter className="full">{!mandatory && <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>}<Button type="submit">{mandatory ? "Guardar y entrar" : "Guardar"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function InvitationDialog({ user, organization, volunteer, opportunities, open, onOpenChange, onSaved }: { user: SessionUser; organization: Organization; volunteer: VolunteerProfile | null; opportunities: Opportunity[]; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (invitation: Invitation) => void }) {
  const [loading, setLoading] = useState(false);
  if (!volunteer) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const opportunity = opportunities.find((item) => item.id === String(form.get("opportunityId")));
    const message = String(form.get("message")).trim();
    if (!opportunity || message.length < 10) return toast.error("Elegí una oportunidad y escribí un mensaje breve.");
    setLoading(true);
    try {
      const next = user.isDemo
        ? { id: `demo-invitation-${Date.now()}`, opportunityId: opportunity.id, opportunityTitle: opportunity.title, organizationId: organization.id, organizationName: organization.name, userId: volunteer!.id, userName: volunteer!.name, message, status: "pending" as const, createdAt: new Date().toISOString() }
        : await createInvitation(user, organization, opportunity, volunteer!, message);
      onSaved(next);
      onOpenChange(false);
      toast.success("Propuesta enviada", { description: `${volunteer!.name} podrá aceptarla o rechazarla desde su espacio.` });
    } catch (error) { toast.error("No pudimos enviar la propuesta", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); }
    finally { setLoading(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>Invitar a {volunteer.name}</DialogTitle><DialogDescription>La propuesta llegará como notificación y no genera un match hasta que la persona acepte.</DialogDescription></DialogHeader><form className="create-form" onSubmit={submit}><label className="full">Oportunidad<Select name="opportunityId" defaultValue={opportunities[0]?.id}><SelectTrigger><SelectValue placeholder="Elegí una oportunidad" /></SelectTrigger><SelectContent>{opportunities.map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent></Select></label><label className="full">Mensaje<Textarea name="message" minLength={10} maxLength={400} defaultValue={`Hola ${volunteer.name}, creemos que tu perfil puede aportar mucho a esta oportunidad. ¿Te gustaría participar?`} required /></label><DialogFooter className="full"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={loading}>{loading ? "Enviando…" : "Enviar propuesta"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function OpportunityEditor({ user, organization, opportunity, open, onOpenChange, onSaved }: { user: SessionUser; organization: Organization; opportunity: Opportunity | null; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (opportunity: Opportunity) => void }) {
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const date = String(form.get("date")); const data: Omit<Opportunity, "id"> = { title: String(form.get("title")), organization: organization.name, organizationId: organization.id, description: String(form.get("description")), tasks: splitList(form.get("tasks")), requirements: splitList(form.get("requirements")), requiredSkills: splitList(form.get("skills")), availability: splitList(form.get("availability")), modality: String(form.get("modality")) as Opportunity["modality"], date, dateLabel: new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)), time: String(form.get("time")), neighborhood: String(form.get("location")), addressHint: String(form.get("location")), latitude: -31.4167, longitude: -64.1833, distanceKm: 0, capacity: Number(form.get("capacity")), availableSpots: Number(form.get("capacity")), category: String(form.get("category")), province: String(form.get("province")), imageUrl: opportunity?.imageUrl ?? "https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1200&q=80", visibility: "public", status: "published" }; if (!data.title || !data.description || !data.tasks.length || !data.requiredSkills?.length || !data.availability?.length) return toast.error("Completá todos los datos necesarios para el análisis."); try { const next = opportunity ? { ...data, id: opportunity.id } : user.isDemo ? { ...data, id: `demo-${Date.now()}` } : await createOpportunity(data); if (opportunity && !user.isDemo) await updateOpportunity(next); onSaved(next); onOpenChange(false); toast.success(opportunity ? "Oportunidad actualizada" : "Oportunidad publicada"); } catch (error) { toast.error("No pudimos guardar", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); } }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>{opportunity ? "Editar oportunidad" : "Nueva oportunidad"}</DialogTitle><DialogDescription>Registrá tareas, habilidades, disponibilidad, modalidad y ubicación.</DialogDescription></DialogHeader><form className="create-form" onSubmit={submit}><label className="full">Título<Input name="title" defaultValue={opportunity?.title} required /></label><label className="full">Descripción<Textarea name="description" defaultValue={opportunity?.description} required /></label><label>Área de interés<Input name="category" defaultValue={opportunity?.category} required /></label><label>Modalidad<Select name="modality" defaultValue={opportunity?.modality ?? "Presencial"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Presencial">Presencial</SelectItem><SelectItem value="Virtual">Virtual</SelectItem><SelectItem value="Híbrida">Híbrida</SelectItem></SelectContent></Select></label><label>Provincia<Input name="province" defaultValue={opportunity?.province ?? "Córdoba"} required /></label><label>Ubicación<Input name="location" defaultValue={opportunity?.neighborhood} required /></label><label>Fecha<Input type="date" name="date" defaultValue={opportunity?.date} required /></label><label>Horario<Input name="time" defaultValue={opportunity?.time} placeholder="09:00–12:30" required /></label><label>Cupos<Input type="number" min="1" name="capacity" defaultValue={opportunity?.capacity ?? 10} required /></label><label>Disponibilidad solicitada<Input name="availability" defaultValue={(opportunity?.availability ?? []).join(", ")} placeholder="Sábado por la mañana" required /></label><label className="full">Tareas separadas por coma<Input name="tasks" defaultValue={opportunity?.tasks.join(", ")} required /></label><label className="full">Habilidades requeridas separadas por coma<Input name="skills" defaultValue={(opportunity?.requiredSkills ?? []).join(", ")} required /></label><label className="full">Requisitos adicionales<Input name="requirements" defaultValue={opportunity?.requirements.join(", ")} /></label><DialogFooter className="full"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit">{opportunity ? "Guardar cambios" : "Publicar"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function ExperienceDialog({ user, organization, application, open, onOpenChange, onCompleted }: { user: SessionUser; organization: Organization; application: Application | null; open: boolean; onOpenChange: (open: boolean) => void; onCompleted: (application: Application, skills: string[], tasks: string[]) => void }) {
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  if (!application) return null;
  function toggleSkill(name: string) {
    setSelectedSkills((current) => {
      if (current.includes(name)) return current.filter((item) => item !== name);
      return [...current, name];
    });
  }
  function changeOpen(nextOpen: boolean) { if (!nextOpen) setSelectedSkills([]); onOpenChange(nextOpen); }
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const tasks = splitList(form.get("tasks")); const skills = selectedSkills; if (!tasks.length) return toast.error("Detallá las tareas que realizó la persona voluntaria."); try { if (!user.isDemo) await recordCompletedExperience(application!, { tasks, skills, organizationName: organization.name }); const next = { ...application!, completedAt: new Date().toISOString() }; onCompleted(next, skills, tasks); changeOpen(false); if (!skills.length) toast.warning("Experiencia registrada sin habilidades verificadas", { description: "La trayectoria se guardó, pero no aportará nuevas habilidades a las recomendaciones." }); else toast.success("Experiencia incorporada a la trayectoria"); } catch (error) { toast.error("No pudimos registrar la experiencia", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); } }
  return <Dialog open={open} onOpenChange={changeOpen}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>Registrar participación realizada</DialogTitle><DialogDescription>{application.userName} · {application.opportunityTitle}</DialogDescription></DialogHeader><form className="create-form" onSubmit={submit}><label className="full">¿Qué tareas realizó? Separalas por coma<Input name="tasks" placeholder="Preparó materiales, coordinó el juego" required /></label><fieldset className="skill-checks full"><legend>Habilidades demostradas</legend><p>Seleccioná únicamente las habilidades observadas durante esta experiencia.</p><div>{VERIFIED_SKILL_OPTIONS.map((skill) => <label key={skill}><input type="checkbox" checked={selectedSkills.includes(skill)} onChange={() => toggleSkill(skill)} />{skill}</label>)}</div></fieldset><span className="skill-counter full">{selectedSkills.length} habilidades seleccionadas</span><DialogFooter className="full"><Button type="button" variant="outline" onClick={() => changeOpen(false)}>Cancelar</Button><Button type="submit">Completar participación</Button></DialogFooter></form></DialogContent></Dialog>;
}
