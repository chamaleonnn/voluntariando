"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight, Ban, Bot, Building2, CalendarDays, Check, ChevronRight, CirclePlay, Clock3,
  Globe2, HeartHandshake, LogOut, Map, MapPin, Moon, Pencil, Plus, Search, Settings2,
  Shield, ShieldCheck, Sparkles, Sun, Trash2, UserCog, UserRound, Users,
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
import { DEMO_APPLICATIONS, DEMO_OPPORTUNITIES, DEMO_VOLUNTEERS } from "@/lib/demo-data";
import {
  createApplication, createOpportunity, firebaseSignInWithGoogle, firebaseSignOut,
  observeApplications, observeAuth, observeOpportunities, observeOrganizations,
  observeVolunteerProfile, recordCompletedExperience, saveOrganizationProfile,
  saveVolunteerProfile, updateApplicationStatus, updateOpportunity,
} from "@/lib/firebase-service";
import { isFirebaseConfigured } from "@/lib/firebase";
import { recommendOpportunities } from "@/lib/recommendations";
import type { Application, Opportunity, Organization, SessionUser, VolunteerProfile } from "@/lib/types";

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

function splitList(value: FormDataEntryValue | null) {
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function screenForRole(role: SessionUser["role"]): Screen {
  if (role === "organization") return "organization";
  if (role === "admin") return "admin";
  return "volunteer";
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>(DEMO_OPPORTUNITIES);
  const [applications, setApplications] = useState<Application[]>(DEMO_APPLICATIONS);
  const [profile, setProfile] = useState<VolunteerProfile>(DEMO_VOLUNTEERS[0]);
  const [organizations, setOrganizations] = useState<Organization[]>([DEMO_ORGANIZATION]);
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

  useEffect(() => observeAuth((nextUser) => { if (nextUser) setUser(nextUser); }), []);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const fail = (error: Error) => console.error("Lectura pública de Firebase", error);
    const stopOpportunities = observeOpportunities((items) => {
      if (!items.length) return;
      // Durante el piloto completamos el catálogo con ejemplos hasta llegar a cinco casos.
      const ids = new Set(items.map((item) => item.id));
      setOpportunities([...items, ...DEMO_OPPORTUNITIES.filter((item) => !ids.has(item.id))].slice(0, 5));
    }, fail);
    const stopOrganizations = observeOrganizations((items) => { if (items.length) setOrganizations(items); }, fail);
    return () => { stopOpportunities(); stopOrganizations(); };
  }, []);

  useEffect(() => {
    if (!user || user.isDemo) return;
    const fail = (error: Error) => console.error("Sincronización privada", error);
    const stops = [observeApplications(user, setApplications, fail)];
    if (user.role === "volunteer") stops.push(observeVolunteerProfile(user.uid, (next) => { if (next) setProfile(next); }));
    return () => stops.forEach((stop) => stop());
  }, [user]);

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
    setUser(nextUser);
    setAuthOpen(false);
    setScreen(screenForRole(nextUser.role));
    toast.success(`Entraste como ${nextUser.displayName}`);
  }

  function signOut() {
    // La interfaz sale de inmediato mientras Firebase limpia la sesión.
    void firebaseSignOut().catch(() => undefined);
    setUser(null);
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
    ? organizations.find((item) => item.id === user.uid || (user.isDemo && item.id === "fundemos")) ?? DEMO_ORGANIZATION
    : DEMO_ORGANIZATION;

  return (
    <main className="site-shell">
      <div className="ambient-background" aria-hidden="true"><span className="ambient-orb ambient-orb-one" /><span className="ambient-orb ambient-orb-two" /><span className="ambient-orb ambient-orb-three" /></div>
      <Toaster position="top-center" richColors />
      <SiteHeader screen={screen} user={user} onTheme={toggleTheme} onNavigate={navigate} onLogin={() => setAuthOpen(true)} onSwitchRole={() => setRoleOpen(true)} onSignOut={signOut} />
      <div className="screen-stage" key={screen}>
        {screen === "landing" && <Landing opportunities={opportunities} onExplore={() => navigate("opportunities")} onLogin={() => setAuthOpen(true)} />}
        {screen === "opportunities" && <OpportunityFeed opportunities={recommended} user={user} onOpen={setSelectedOpportunity} />}
        {screen === "volunteer" && user?.role === "volunteer" && (
          <VolunteerPanel user={user} profile={profile} applications={applications} opportunities={recommended} onProfile={setProfile} onExplore={() => navigate("opportunities")} />
        )}
        {screen === "organization" && user?.role === "organization" && (
          <OrganizationPanel
            user={user} organization={organization} opportunities={opportunities} applications={applications}
            onOrganization={(next) => setOrganizations((current) => [...current.filter((item) => item.id !== next.id), next])}
            onOpportunities={setOpportunities} onApplications={setApplications} onProfile={setProfile}
          />
        )}
        {screen === "admin" && user?.role === "admin" && <AdminPanel opportunities={opportunities} applications={applications} />}
      </div>
      <GuideAssistant user={user} profile={profile} opportunities={recommended} onOpenOpportunity={setSelectedOpportunity} />
      <OpportunityDialog opportunity={selectedOpportunity} user={user} applications={applications} open={Boolean(selectedOpportunity)} onOpenChange={(open) => !open && setSelectedOpportunity(null)} onApply={apply} />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} onUser={loginAs} />
      <RoleSwitcher open={roleOpen} onOpenChange={setRoleOpen} onUser={loginAs} />
    </main>
  );
}

function SiteHeader({ screen, user, onTheme, onNavigate, onLogin, onSwitchRole, onSignOut }: {
  screen: Screen; user: SessionUser | null; onTheme: () => void; onNavigate: (screen: Screen) => void; onLogin: () => void; onSwitchRole: () => void; onSignOut: () => void;
}) {
  const account = user ? screenForRole(user.role) : "volunteer";
  return <header className="site-header">
    <button className="brand" onClick={() => onNavigate("landing")}><span className="brand-mark"><HeartHandshake /></span><span>Red Cercana<small>identidad provisoria</small></span></button>
    <nav className="main-nav" aria-label="Navegación principal"><button className={screen === "landing" ? "active" : ""} onClick={() => onNavigate("landing")}>Inicio</button><button className={screen === "opportunities" ? "active" : ""} onClick={() => onNavigate("opportunities")}>Oportunidades</button>{user && <button className={screen === account ? "active" : ""} onClick={() => onNavigate(account)}>Mi espacio</button>}</nav>
    <div className="header-account"><Button className="theme-toggle" variant="ghost" size="icon" onClick={onTheme} aria-label="Cambiar tema de color"><Moon className="theme-icon-light" /><Sun className="theme-icon-dark" /></Button>{user ? <><button className="account-chip" onClick={onSwitchRole} title="Cambiar rol"><span>{user.displayName.charAt(0)}</span><b>{user.displayName}</b><UserCog /></button><Button variant="ghost" size="icon" onClick={onSignOut} aria-label="Cerrar sesión"><LogOut /></Button></> : <Button className="soft-button" onClick={onLogin}>Ingresar</Button>}</div>
  </header>;
}

function Landing({ opportunities, onExplore, onLogin }: { opportunities: Opportunity[]; onExplore: () => void; onLogin: () => void }) {
  const [guide, setGuide] = useState<number | null>(null);
  const steps = [
    { title: "Creá tu perfil", text: "Registrá intereses, habilidades y ubicación.", videoSrc: "/videos/crear-perfil.mp4", posterSrc: "/videos/crear-perfil.png" },
    { title: "Recibí recomendaciones", text: "El sistema calcula y explica la compatibilidad.", videoSrc: "/videos/recibir-recomendaciones.mp4", posterSrc: "/videos/recibir-recomendaciones.png" },
    { title: "Mostrá interés", text: "La organización acepta o rechaza la solicitud.", videoSrc: "/videos/mostrar-interes.mp4", posterSrc: "/videos/mostrar-interes.png" },
    { title: "Sumá experiencia", text: "Las habilidades verificadas actualizan tu trayectoria.", videoSrc: "/videos/sumar-experiencia.mp4", posterSrc: "/videos/sumar-experiencia.png" },
  ];
  return <>
    <section className="hero-section document-hero">
      <div className="hero-copy"><Badge className="hero-kicker"><Sparkles /> Voluntariado que deja huella</Badge><h1>Conectamos personas que quieren ayudar con oportunidades de voluntariado.</h1><p>Descubrí, postuláte y construí una trayectoria que mejora tus próximas recomendaciones.</p><div className="hero-actions"><Button size="lg" onClick={onExplore}>Explorar oportunidades <ArrowRight /></Button><Button size="lg" variant="outline" onClick={onLogin}>Ingresar con Google</Button></div><span className="hero-note"><ShieldCheck /> Las oportunidades se pueden explorar sin iniciar sesión.</span></div>
      <div className="landing-opportunity-showcase">{opportunities.slice(0, 3).map((item) => <article key={item.id}><div style={{ backgroundImage: `url(${item.imageUrl})` }} /><span>{item.category}</span><h3>{item.title}</h3><p><MapPin /> {item.neighborhood}, {item.province}</p></article>)}</div>
    </section>
    <section className="how-section"><div className="section-heading"><span>Cómo funciona</span><h2>De la oportunidad a una nueva experiencia</h2><p>Elegí un paso para ver su recorrido animado.</p></div><div className="steps-row">{steps.map((step, index) => <Step key={step.title} number={String(index + 1)} title={step.title} text={step.text} onOpen={() => setGuide(index)} />)}</div></section>
    <section className="landing-cta"><div><span><Globe2 /> Plataforma de alcance global</span><h2>El piloto comienza en Córdoba.</h2><p>Córdoba aporta los primeros casos de la tesis, pero la ubicación no limita el uso del sistema.</p></div><Button size="lg" onClick={onExplore}>Ver oportunidades <ChevronRight /></Button></section>
    <StepGuideDialog step={guide === null ? null : steps[guide]} number={guide === null ? 0 : guide + 1} open={guide !== null} onOpenChange={(open) => !open && setGuide(null)} />
  </>;
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
  return <article className="feed-opportunity-card"><div className="opportunity-photo" style={{ backgroundImage: `url(${item.imageUrl})` }}><Badge>{item.category}</Badge></div><div className="opportunity-copy">{personalized && <div className="compatibility-row"><strong>{item.compatibility ?? 0}% compatible</strong><span><i style={{ width: `${item.compatibility ?? 0}%` }} /></span></div>}<div className="opportunity-heading"><div><h2>{item.title}</h2><p>{item.organization}</p></div></div><div className="opportunity-info"><span><CalendarDays /> {item.dateLabel}</span><span><Clock3 /> {item.time}</span><span><MapPin /> {item.neighborhood}</span><span>{item.modality ?? "Presencial"}</span></div><p className="opportunity-description">{item.description}</p>{personalized && <p className="recommendation-reason">{item.recommendedBecause}</p>}<footer><span><Users /> {item.availableSpots} lugares disponibles</span><Button size="sm" onClick={onOpen}>Ver detalle</Button></footer></div></article>;
}

function VolunteerPanel({ user, profile, applications, opportunities, onProfile, onExplore }: { user: SessionUser; profile: VolunteerProfile; applications: Application[]; opportunities: Opportunity[]; onProfile: (profile: VolunteerProfile) => void; onExplore: () => void }) {
  const [editOpen, setEditOpen] = useState(false);
  return <Dashboard title={`Hola, ${profile.name}`} description="Tu perfil y tu trayectoria determinan las recomendaciones." icon={<UserRound />} action={<Button onClick={() => setEditOpen(true)}><Pencil /> Editar perfil</Button>}>
    <div className="stats-grid"><Stat label="Experiencias" value={profile.completedExperiences} detail="completadas" /><Stat label="Intereses" value={profile.interests.length} detail="registrados" /><Stat label="Habilidades" value={(profile.declaredSkills ?? []).length} detail="declaradas" /><Stat label="Verificadas" value={Object.keys(profile.verifiedSkills ?? {}).length} detail="por organizaciones" /></div>
    <div className="dashboard-grid"><section className="panel-card wide-panel"><div className="panel-heading"><div><span>Opciones para vos</span><h2>Mayor compatibilidad</h2></div><Button variant="outline" onClick={onExplore}>Ver todas</Button></div><div className="mini-opportunity-grid">{opportunities.slice(0, 3).map((item) => <div key={item.id}><b>{item.compatibility ?? 0}%</b><h3>{item.title}</h3><p>{item.recommendedBecause}</p></div>)}</div></section>
      <section className="panel-card"><div className="panel-heading"><div><span>Perfil</span><h2>Datos para el análisis</h2></div></div><Info label="Ubicación" value={profile.location} /><Info label="Intereses" value={profile.interests.join(", ") || "Sin completar"} /><Info label="Habilidades" value={(profile.declaredSkills ?? []).join(", ") || "Sin completar"} /><Info label="Disponibilidad" value={(profile.availability ?? []).join(", ") || "Sin completar"} /></section>
      <section className="panel-card"><div className="panel-heading"><div><span>Solicitudes</span><h2>Estado de tus postulaciones</h2></div></div><div className="timeline-list">{applications.filter((item) => item.userId === user.uid || user.isDemo).map((item) => <div key={item.id}><span className="timeline-icon"><Check /></span><div><b>{item.opportunityTitle}</b><p>{item.completedAt ? "Experiencia completada" : item.status === "accepted" ? "Participación confirmada" : item.status === "rejected" ? "Solicitud rechazada" : "Pendiente de respuesta"}</p></div><Badge variant="secondary">{item.completedAt ? "Completada" : item.status}</Badge></div>)}</div></section>
      <section className="panel-card wide-panel"><div className="panel-heading"><div><span>Trayectoria</span><h2>Experiencias verificadas</h2></div></div><div className="timeline-list">{(profile.experiences ?? []).length ? profile.experiences!.map((item) => <div key={`${item.opportunityId}-${item.completedAt}`}><span className="timeline-icon"><Check /></span><div><b>{item.opportunityTitle}</b><p>{item.organization} · {item.tasks.join(", ")}</p><small>Habilidades observadas: {item.skills.join(", ")}</small></div></div>) : <p className="panel-note">Las experiencias completadas aparecerán acá.</p>}</div></section>
    </div><VolunteerProfileDialog user={user} profile={profile} open={editOpen} onOpenChange={setEditOpen} onSaved={onProfile} />
  </Dashboard>;
}

function OrganizationPanel({ user, organization, opportunities, applications, onOrganization, onOpportunities, onApplications, onProfile }: { user: SessionUser; organization: Organization; opportunities: Opportunity[]; applications: Application[]; onOrganization: (organization: Organization) => void; onOpportunities: (items: Opportunity[]) => void; onApplications: (items: Application[]) => void; onProfile: (profile: VolunteerProfile) => void }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [opportunityOpen, setOpportunityOpen] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [experience, setExperience] = useState<Application | null>(null);
  const own = opportunities.filter((item) => item.organizationId === organization.id || (user.isDemo && item.organizationId === "fundemos"));
  const requests = applications.filter((item) => own.some((opportunity) => opportunity.id === item.opportunityId) || user.isDemo);
  async function decide(item: Application, status: "accepted" | "rejected") {
    try {
      if (!user.isDemo) await updateApplicationStatus(item, status);
      onApplications(applications.map((current) => current.id === item.id ? { ...current, status } : current));
      toast.success(status === "accepted" ? "Participación confirmada" : "Solicitud rechazada");
    } catch (error) { toast.error("No pudimos actualizar la solicitud", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); }
  }
  return <Dashboard title={organization.name} description="Gestioná el perfil, las oportunidades y las participaciones." icon={<Building2 />} action={<Button onClick={() => { setEditing(null); setOpportunityOpen(true); }}><Plus /> Nueva oportunidad</Button>}>
    <div className="stats-grid"><Stat label="Oportunidades" value={own.length} detail="publicadas" /><Stat label="Interesados" value={requests.filter((item) => item.status === "pending").length} detail="pendientes" /><Stat label="Confirmados" value={requests.filter((item) => item.status === "accepted" && !item.completedAt).length} detail="participaciones" /><Stat label="Completadas" value={requests.filter((item) => item.completedAt).length} detail="experiencias" /></div>
    <div className="dashboard-grid"><section className="panel-card wide-panel"><div className="panel-heading"><div><span>Perfil</span><h2>Información de la organización</h2></div><Button variant="outline" onClick={() => setProfileOpen(true)}><Pencil /> Editar</Button></div><p>{organization.description}</p><Info label="Ubicación" value={organization.location ?? organization.province} /><Info label="Contacto" value={organization.contact ?? organization.email} /></section>
      <section className="panel-card wide-panel"><div className="panel-heading"><div><span>Publicaciones</span><h2>Oportunidades</h2></div></div><div className="timeline-list">{own.map((item) => <div key={item.id}><span className="timeline-icon"><CalendarDays /></span><div><b>{item.title}</b><p>{item.modality ?? "Presencial"} · {(item.availability ?? []).join(", ")}</p></div><Button size="sm" variant="outline" onClick={() => { setEditing(item); setOpportunityOpen(true); }}>Editar</Button></div>)}</div></section>
      <section className="panel-card wide-panel"><div className="panel-heading"><div><span>Vinculación</span><h2>Solicitudes de participación</h2></div></div><div className="timeline-list">{requests.map((item) => <div key={item.id}><span className="profile-avatar">{item.userName.charAt(0)}</span><div><b>{item.userName}</b><p>{item.opportunityTitle} · {item.status}</p></div>{item.status === "pending" ? <span className="inline-actions"><Button size="sm" onClick={() => void decide(item, "accepted")}>Aceptar</Button><Button size="sm" variant="outline" onClick={() => void decide(item, "rejected")}>Rechazar</Button></span> : item.status === "accepted" && !item.completedAt ? <Button size="sm" onClick={() => setExperience(item)}>Marcar realizada</Button> : <Badge variant="secondary">{item.completedAt ? "Completada" : item.status}</Badge>}</div>)}</div></section>
    </div>
    <OrganizationProfileDialog user={user} organization={organization} open={profileOpen} onOpenChange={setProfileOpen} onSaved={onOrganization} />
    <OpportunityEditor user={user} organization={organization} opportunity={editing} open={opportunityOpen} onOpenChange={setOpportunityOpen} onSaved={(next) => onOpportunities(editing ? opportunities.map((item) => item.id === next.id ? next : item) : [next, ...opportunities])} />
    <ExperienceDialog user={user} organization={organization} application={experience} open={Boolean(experience)} onOpenChange={(open) => !open && setExperience(null)} onCompleted={(next, skills, tasks) => { onApplications(applications.map((item) => item.id === next.id ? next : item)); onProfile({ ...DEMO_VOLUNTEERS[0], completedExperiences: DEMO_VOLUNTEERS[0].completedExperiences + 1, verifiedSkills: { ...(DEMO_VOLUNTEERS[0].verifiedSkills ?? {}), ...Object.fromEntries(skills.map((skill) => [skill, 1])) }, experiences: [...(DEMO_VOLUNTEERS[0].experiences ?? []), { opportunityId: next.opportunityId, opportunityTitle: next.opportunityTitle, organization: organization.name, tasks, skills, completedAt: new Date().toISOString() }] }); }} />
  </Dashboard>;
}

function AdminPanel({ opportunities, applications }: { opportunities: Opportunity[]; applications: Application[] }) {
  const demoUsers = [DEMO_USERS.volunteer, DEMO_USERS.organization, DEMO_USERS.admin];
  const simulate = (action: string, target: string) => toast.success(`${action}: ${target}`, { description: "Acción simulada en el prototipo. No modifica datos reales." });
  return <Dashboard title="Administración" description="Supervisión general, moderación y corrección de la plataforma." icon={<Shield />} action={<Badge variant="secondary">Modo demostración</Badge>}>
    <div className="stats-grid"><Stat label="Usuarios" value={demoUsers.length} detail="perfiles simulados" /><Stat label="Oportunidades" value={opportunities.length} detail="publicadas" /><Stat label="Solicitudes" value={applications.length} detail="registradas" /><Stat label="Alertas" value={2} detail="para revisar" /></div>
    <div className="dashboard-grid admin-grid">
      <section className="panel-card wide-panel"><div className="panel-heading"><div><span>Control de usuarios</span><h2>Perfiles, roles y contacto</h2></div></div><div className="admin-list">{demoUsers.map((item) => <div key={item.uid}><span className="admin-icon green">{item.role === "organization" ? <Building2 /> : item.role === "admin" ? <Shield /> : <UserRound />}</span><div><b>{item.displayName}</b><p>{item.email} · {item.role}</p></div><span className="inline-actions"><Button size="sm" variant="outline" onClick={() => simulate("Perfil corregido", item.displayName)}><Settings2 /> Corregir</Button><Button size="sm" variant="outline" onClick={() => simulate("Cuenta suspendida", item.displayName)}><Ban /> Suspender</Button></span></div>)}</div></section>
      <section className="panel-card"><div className="panel-heading"><div><span>Moderación</span><h2>Contenido pendiente</h2></div></div><div className="admin-list"><div><span className="admin-icon amber"><ShieldCheck /></span><div><b>Foto de reseña</b><p>Requiere aprobación antes de publicarse.</p></div><Button size="sm" onClick={() => simulate("Foto aprobada", "reseña reciente")}>Revisar</Button></div><div><span className="admin-icon amber"><Bot /></span><div><b>Devolución de experiencia</b><p>Lista para validar antes del análisis asistido.</p></div><Button size="sm" onClick={() => simulate("Devolución validada", "experiencia")}>Validar</Button></div></div></section>
      <section className="panel-card"><div className="panel-heading"><div><span>Acciones globales</span><h2>Intervención administrativa</h2></div></div><div className="admin-actions"><Button variant="outline" onClick={() => simulate("Oportunidad corregida", opportunities[0]?.title ?? "oportunidad")}><Pencil /> Editar publicación</Button><Button variant="outline" onClick={() => simulate("Contenido eliminado", "publicación denunciada")}><Trash2 /> Eliminar contenido</Button><Button variant="outline" onClick={() => simulate("Suspensión temporal aplicada", "cuenta reportada")}><Ban /> Suspender por tiempo</Button></div></section>
    </div>
  </Dashboard>;
}

function GuideAssistant({ user, profile, opportunities, onOpenOpportunity }: { user: SessionUser | null; profile: VolunteerProfile; opportunities: Opportunity[]; onOpenOpportunity: (item: Opportunity) => void }) {
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState("aprender");
  const [format, setFormat] = useState("cualquiera");
  const suggested = opportunities.find((item) => format === "cualquiera" || item.modality?.toLocaleLowerCase("es") === format) ?? opportunities[0];
  return <aside className={`guide-assistant ${open ? "open" : ""}`}><button className="assistant-launcher" onClick={() => setOpen((value) => !value)} aria-label="Abrir asistente orientador"><span className="mascot-face"><i /><i /></span><b>{open ? "Cerrar" : "Te ayudo"}</b></button>{open && <div className="assistant-panel"><header><span className="mascot-face large"><i /><i /></span><div><b>Asistente orientador</b><small>Prototipo de recomendación con IA</small></div></header><p>{user?.role === "volunteer" ? `Hola, ${profile.name.split(" ")[0]}. Ya consideré tus ${profile.completedExperiences} experiencias y habilidades verificadas.` : "Respondé dos preguntas y te ayudo a encontrar una oportunidad."}</p><label>¿Qué buscás en tu próxima experiencia?<Select value={goal} onValueChange={setGoal}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="aprender">Aprender algo nuevo</SelectItem><SelectItem value="comunidad">Ayudar a mi comunidad</SelectItem><SelectItem value="experiencia">Fortalecer mi perfil</SelectItem></SelectContent></Select></label><label>¿Qué modalidad preferís?<Select value={format} onValueChange={setFormat}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cualquiera">Cualquiera</SelectItem><SelectItem value="presencial">Presencial</SelectItem><SelectItem value="virtual">Virtual</SelectItem><SelectItem value="híbrida">Híbrida</SelectItem></SelectContent></Select></label>{suggested && <button className="assistant-result" onClick={() => { onOpenOpportunity(suggested); setOpen(false); }}><Sparkles /><span><small>Recomendación para vos</small><b>{suggested.title}</b><em>{goal === "aprender" ? "Te permite sumar habilidades nuevas." : goal === "comunidad" ? "Tiene impacto comunitario directo." : "Puede fortalecer tu trayectoria verificada."}</em></span><ChevronRight /></button>}</div>}</aside>;
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
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="opportunity-dialog"><div className="dialog-cover" style={{ backgroundImage: `url(${opportunity.imageUrl})` }}><Badge>{opportunity.category}</Badge></div><DialogHeader><DialogTitle>{opportunity.title}</DialogTitle><DialogDescription>{opportunity.organization}</DialogDescription></DialogHeader>{opportunity.compatibility !== undefined && <div className="compatibility-detail"><strong>{opportunity.compatibility}% de compatibilidad</strong>{breakdown && <div>{Object.entries(breakdown).map(([key, value]) => <span key={key}>{({ skills: "Habilidades", interests: "Intereses", availability: "Disponibilidad", location: "Ubicación/modalidad", experience: "Experiencias" } as Record<string, string>)[key]}: {value}%</span>)}</div>}<p>{opportunity.recommendedBecause}</p></div>}<div className="dialog-facts"><span><CalendarDays /> {opportunity.dateLabel}</span><span><Clock3 /> {opportunity.time}</span><span><MapPin /> {opportunity.neighborhood}</span><span>{opportunity.modality ?? "Presencial"}</span></div><p className="dialog-description">{opportunity.description}</p><div className="dialog-columns"><section><h3>Tareas</h3>{opportunity.tasks.map((item) => <p key={item}><Check /> {item}</p>)}</section><section><h3>Habilidades requeridas</h3>{(opportunity.requiredSkills ?? opportunity.requirements).map((item) => <p key={item}><Check /> {item}</p>)}</section></div><p className="privacy-note"><MapPin /><span><b>Ubicación</b>{opportunity.addressHint}</span></p><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button><Button disabled={applied || user?.role === "organization"} onClick={() => onApply(opportunity)}>{applied ? "Interés registrado" : "Me interesa"}</Button></DialogFooter></DialogContent></Dialog>;
}

function AuthDialog({ open, onOpenChange, onUser }: { open: boolean; onOpenChange: (open: boolean) => void; onUser: (user: SessionUser) => void }) {
  const [loading, setLoading] = useState(false);
  async function login(role: "volunteer" | "organization") { setLoading(true); try { const next = await firebaseSignInWithGoogle(role); onUser(next); } catch (error) { toast.error("No pudimos iniciar sesión", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); } finally { setLoading(false); } }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="auth-dialog"><DialogHeader><span className="auth-mark"><HeartHandshake /></span><DialogTitle>Ingresá con Google</DialogTitle><DialogDescription>En el primer acceso elegí el perfil que vas a utilizar.</DialogDescription></DialogHeader><Button variant="outline" onClick={() => void login("volunteer")} disabled={loading}><UserRound /> Continuar como voluntario</Button><Button variant="outline" onClick={() => void login("organization")} disabled={loading}><Building2 /> Continuar como organización</Button><p className="demo-hint">Recorré el prototipo sin crear datos reales y cambiá de rol cuando quieras:</p><div className="demo-role-grid"><button onClick={() => onUser(DEMO_USERS.volunteer)}><UserRound /><span><b>Voluntario demo</b><small>Perfil y recomendaciones</small></span></button><button onClick={() => onUser(DEMO_USERS.organization)}><Building2 /><span><b>Organización demo</b><small>Oportunidades y solicitudes</small></span></button><button onClick={() => onUser(DEMO_USERS.admin)}><Shield /><span><b>Administrador demo</b><small>Supervisión y moderación</small></span></button></div></DialogContent></Dialog>;
}

function VolunteerProfileDialog({ user, profile, open, onOpenChange, onSaved }: { user: SessionUser; profile: VolunteerProfile; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (profile: VolunteerProfile) => void }) {
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const next = { ...profile, name: String(form.get("name")), location: String(form.get("location")), bio: String(form.get("bio")), interests: splitList(form.get("interests")), declaredSkills: splitList(form.get("skills")), availability: splitList(form.get("availability")) }; if (!next.name || !next.location || !next.interests.length || !next.declaredSkills.length || !next.availability.length) return toast.error("Completá nombre, ubicación, intereses, habilidades y disponibilidad."); try { if (!user.isDemo) await saveVolunteerProfile(next); onSaved(next); onOpenChange(false); toast.success("Perfil actualizado"); } catch (error) { toast.error("No pudimos guardar", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); } }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>Configurar perfil</DialogTitle><DialogDescription>Estos datos se utilizan para calcular la compatibilidad.</DialogDescription></DialogHeader><form className="create-form" onSubmit={submit}><label>Nombre<Input name="name" defaultValue={profile.name} required /></label><label>Ubicación<Input name="location" defaultValue={profile.location} required /></label><label className="full">Sobre mí<Textarea name="bio" defaultValue={profile.bio} /></label><label className="full">Intereses separados por coma<Input name="interests" defaultValue={profile.interests.join(", ")} required /></label><label className="full">Habilidades separadas por coma<Input name="skills" defaultValue={(profile.declaredSkills ?? []).join(", ")} required /></label><label className="full">Disponibilidad separada por coma<Input name="availability" defaultValue={(profile.availability ?? []).join(", ")} placeholder="Sábado por la mañana" required /></label><DialogFooter className="full"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit">Guardar perfil</Button></DialogFooter></form></DialogContent></Dialog>;
}

function OrganizationProfileDialog({ user, organization, open, onOpenChange, onSaved }: { user: SessionUser; organization: Organization; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (organization: Organization) => void }) {
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const next = { ...organization, name: String(form.get("name")), description: String(form.get("description")), location: String(form.get("location")), province: String(form.get("province")), contact: String(form.get("contact")) }; if (!next.name || !next.description || !next.location || !next.contact) return toast.error("Completá todos los campos obligatorios."); try { if (!user.isDemo) await saveOrganizationProfile(next); onSaved(next); onOpenChange(false); toast.success("Perfil actualizado"); } catch (error) { toast.error("No pudimos guardar", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); } }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>Perfil de la organización</DialogTitle><DialogDescription>Información principal y de contacto.</DialogDescription></DialogHeader><form className="create-form" onSubmit={submit}><label>Nombre<Input name="name" defaultValue={organization.name} required /></label><label>Provincia<Input name="province" defaultValue={organization.province} required /></label><label className="full">Descripción<Textarea name="description" defaultValue={organization.description} required /></label><label>Ubicación<Input name="location" defaultValue={organization.location} required /></label><label>Contacto<Input name="contact" defaultValue={organization.contact} required /></label><DialogFooter className="full"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit">Guardar</Button></DialogFooter></form></DialogContent></Dialog>;
}

function OpportunityEditor({ user, organization, opportunity, open, onOpenChange, onSaved }: { user: SessionUser; organization: Organization; opportunity: Opportunity | null; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (opportunity: Opportunity) => void }) {
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const date = String(form.get("date")); const data: Omit<Opportunity, "id"> = { title: String(form.get("title")), organization: organization.name, organizationId: organization.id, description: String(form.get("description")), tasks: splitList(form.get("tasks")), requirements: splitList(form.get("requirements")), requiredSkills: splitList(form.get("skills")), availability: splitList(form.get("availability")), modality: String(form.get("modality")) as Opportunity["modality"], date, dateLabel: new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)), time: String(form.get("time")), neighborhood: String(form.get("location")), addressHint: String(form.get("location")), latitude: -31.4167, longitude: -64.1833, distanceKm: 0, capacity: Number(form.get("capacity")), availableSpots: Number(form.get("capacity")), category: String(form.get("category")), province: String(form.get("province")), imageUrl: opportunity?.imageUrl ?? "https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1200&q=80", visibility: "public", status: "published" }; if (!data.title || !data.description || !data.tasks.length || !data.requiredSkills?.length || !data.availability?.length) return toast.error("Completá todos los datos necesarios para el análisis."); try { const next = opportunity ? { ...data, id: opportunity.id } : user.isDemo ? { ...data, id: `demo-${Date.now()}` } : await createOpportunity(data); if (opportunity && !user.isDemo) await updateOpportunity(next); onSaved(next); onOpenChange(false); toast.success(opportunity ? "Oportunidad actualizada" : "Oportunidad publicada"); } catch (error) { toast.error("No pudimos guardar", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); } }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>{opportunity ? "Editar oportunidad" : "Nueva oportunidad"}</DialogTitle><DialogDescription>Registrá tareas, habilidades, disponibilidad, modalidad y ubicación.</DialogDescription></DialogHeader><form className="create-form" onSubmit={submit}><label className="full">Título<Input name="title" defaultValue={opportunity?.title} required /></label><label className="full">Descripción<Textarea name="description" defaultValue={opportunity?.description} required /></label><label>Área de interés<Input name="category" defaultValue={opportunity?.category} required /></label><label>Modalidad<Select name="modality" defaultValue={opportunity?.modality ?? "Presencial"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Presencial">Presencial</SelectItem><SelectItem value="Virtual">Virtual</SelectItem><SelectItem value="Híbrida">Híbrida</SelectItem></SelectContent></Select></label><label>Provincia<Input name="province" defaultValue={opportunity?.province ?? "Córdoba"} required /></label><label>Ubicación<Input name="location" defaultValue={opportunity?.neighborhood} required /></label><label>Fecha<Input type="date" name="date" defaultValue={opportunity?.date} required /></label><label>Horario<Input name="time" defaultValue={opportunity?.time} placeholder="09:00–12:30" required /></label><label>Cupos<Input type="number" min="1" name="capacity" defaultValue={opportunity?.capacity ?? 10} required /></label><label>Disponibilidad solicitada<Input name="availability" defaultValue={(opportunity?.availability ?? []).join(", ")} placeholder="Sábado por la mañana" required /></label><label className="full">Tareas separadas por coma<Input name="tasks" defaultValue={opportunity?.tasks.join(", ")} required /></label><label className="full">Habilidades requeridas separadas por coma<Input name="skills" defaultValue={(opportunity?.requiredSkills ?? []).join(", ")} required /></label><label className="full">Requisitos adicionales<Input name="requirements" defaultValue={opportunity?.requirements.join(", ")} /></label><DialogFooter className="full"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit">{opportunity ? "Guardar cambios" : "Publicar"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function ExperienceDialog({ user, organization, application, open, onOpenChange, onCompleted }: { user: SessionUser; organization: Organization; application: Application | null; open: boolean; onOpenChange: (open: boolean) => void; onCompleted: (application: Application, skills: string[], tasks: string[]) => void }) {
  if (!application) return null;
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const tasks = splitList(form.get("tasks")); const skills = splitList(form.get("skills")); if (!tasks.length || !skills.length) return toast.error("Registrá tareas y habilidades observadas."); try { if (!user.isDemo) await recordCompletedExperience(application!, { tasks, skills, organizationName: organization.name }); const next = { ...application!, completedAt: new Date().toISOString() }; onCompleted(next, skills, tasks); onOpenChange(false); toast.success("Experiencia incorporada a la trayectoria"); } catch (error) { toast.error("No pudimos registrar la experiencia", { description: error instanceof Error ? error.message : "Intentá nuevamente." }); } }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-dialog"><DialogHeader><DialogTitle>Registrar participación realizada</DialogTitle><DialogDescription>{application.userName} · {application.opportunityTitle}</DialogDescription></DialogHeader><form className="create-form" onSubmit={submit}><label className="full">Tareas realizadas separadas por coma<Input name="tasks" required /></label><label className="full">Habilidades observadas separadas por coma<Input name="skills" required /></label><DialogFooter className="full"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit">Completar participación</Button></DialogFooter></form></DialogContent></Dialog>;
}
