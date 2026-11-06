"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ViaAvatar } from "@/components/via-avatar";
import { VIA_TOUR_STEPS, VIA_VIDEO_STEPS, type TutorialRole, type TutorialScreen } from "@/lib/via-tutorial";

function useTypewriter(text: string, active = true) {
  const [length, setLength] = useState(active ? 0 : text.length);

  useEffect(() => {
    let timer = 0;
    const reset = window.setTimeout(() => {
      setLength(active ? 0 : text.length);
      if (!active) return;
      timer = window.setInterval(() => {
        setLength((value) => {
          if (value >= text.length) {
            window.clearInterval(timer);
            return text.length;
          }
          return Math.min(text.length, value + 2);
        });
      }, 24);
    }, 0);
    return () => { window.clearTimeout(reset); window.clearInterval(timer); };
  }, [active, text]);

  return { visibleText: text.slice(0, length), complete: length >= text.length, showAll: () => setLength(text.length) };
}

function useModalFocus(open: boolean, onEscape: () => void) {
  const ref = useRef<HTMLElement>(null);
  const escapeRef = useRef(onEscape);

  useEffect(() => { escapeRef.current = onEscape; }, [onEscape]);

  useEffect(() => {
    if (!open || !ref.current) return;
    const modal = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () => [...modal.querySelectorAll<HTMLElement>("button, video[controls], [href], [tabindex]:not([tabindex='-1'])")].filter((item) => !item.hasAttribute("disabled"));
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); escapeRef.current(); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, [open]);

  return ref;
}

export function ViaVideoWelcome({ role, open, onOmit, onStartTour }: { role: TutorialRole; open: boolean; onOmit: () => void; onStartTour: () => void }) {
  const [step, setStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const intro = step === 0;
  const current = VIA_VIDEO_STEPS[Math.max(0, step - 1)];
  const last = step === VIA_VIDEO_STEPS.length;
  const message = intro
    ? role === "volunteer"
      ? "¡Hola! Soy Vía y voy a acompañarte en Voluntariando. Acá vas a encontrar formas de ayudar, compartir tus habilidades y vivir nuevas experiencias. ¿Te muestro cómo funciona?"
      : "¡Hola! Soy Vía. Voy a acompañar a tu organización para publicar oportunidades, conocer voluntarios y registrar experiencias verificadas. ¿Empezamos?"
    : current.text;
  const typewriter = useTypewriter(message, open);

  function omit() { setStep(0); setTransitioning(false); onOmit(); }
  const modalRef = useModalFocus(open, omit);

  function startTour() {
    setTransitioning(true);
    window.setTimeout(() => {
      setStep(0);
      setTransitioning(false);
      onStartTour();
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 620);
  }

  if (!open) return null;
  return (
    <div className={`via-welcome-backdrop ${transitioning ? "is-shrinking" : ""}`}>
      <section ref={modalRef} className={`via-welcome ${intro ? "intro" : "video"}`} role="dialog" aria-modal="true" aria-labelledby="via-welcome-title">
        {intro ? <>
          <div className="via-welcome-character"><ViaAvatar state="greeting" size={330} /></div>
          <div className="via-welcome-copy">
            <span>¡Hola! Soy Vía</span>
            <h1 id="via-welcome-title">Te voy a acompañar en Voluntariando.</h1>
            <p aria-live="polite">{typewriter.visibleText}<span className="typewriter-cursor" aria-hidden="true" /></p>
            {!typewriter.complete && <button className="typewriter-skip" onClick={typewriter.showAll}>Mostrar todo el texto</button>}
            <div className="via-welcome-actions"><Button variant="ghost" onClick={omit}>Omitir tutorial</Button><Button size="lg" onClick={() => setStep(1)}>Conocer la app <ArrowRight /></Button></div>
          </div>
        </> : <>
          <div className="via-welcome-video"><video key={current.videoSrc} src={current.videoSrc} controls muted playsInline preload="metadata">Tu navegador no puede reproducir este video.</video></div>
          <div className="via-welcome-explanation"><ViaAvatar state={last ? "celebration" : "talking"} size={150} /><div><span>Vía explica · {step} de {VIA_VIDEO_STEPS.length}</span><h2 id="via-welcome-title">{current.title}</h2><p aria-live="polite">{typewriter.visibleText}<span className="typewriter-cursor" aria-hidden="true" /></p>{!typewriter.complete && <button className="typewriter-skip" onClick={typewriter.showAll}>Mostrar todo el texto</button>}</div></div>
          <div className="via-welcome-progress" aria-label={`Video ${step} de ${VIA_VIDEO_STEPS.length}`}>{VIA_VIDEO_STEPS.map((item, index) => <i key={item.title} className={index < step ? "active" : ""} />)}</div>
          <div className="via-welcome-actions"><Button variant="ghost" onClick={omit}>Omitir tutorial</Button>{step > 1 && <Button variant="outline" onClick={() => setStep((value) => value - 1)}>Anterior</Button>}<Button onClick={() => last ? startTour() : setStep((value) => value + 1)}>{last ? "Comenzar recorrido" : "Siguiente"}</Button></div>
        </>}
      </section>
    </div>
  );
}

export function WelcomeTutorial({ role, open, screen, onNavigate, onOpenChange, onFinish }: {
  role: TutorialRole;
  open: boolean;
  screen: TutorialScreen;
  onNavigate: (screen: TutorialScreen) => void;
  onOpenChange: (open: boolean) => void;
  onFinish: (showVia: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [cardStyle, setCardStyle] = useState<CSSProperties>({});
  const cardRef = useRef<HTMLElement>(null);
  const steps = useMemo(() => VIA_TOUR_STEPS[role], [role]);
  const current = steps[step];
  const last = step === steps.length - 1;
  const typewriter = useTypewriter(current.text, open);

  function close(completed: boolean) {
    document.querySelectorAll(".tour-highlight").forEach((item) => item.classList.remove("tour-highlight"));
    setStep(0);
    onOpenChange(false);
    onFinish(completed && role === "volunteer");
  }

  useEffect(() => {
    if (!open) return;
    if (screen !== current.screen) onNavigate(current.screen);
    let attempts = 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const locate = () => {
      const target = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`);
      if (!target && attempts++ < 12) return window.setTimeout(locate, 120);
      document.querySelectorAll(".tour-highlight").forEach((item) => item.classList.remove("tour-highlight"));
      if (!target) { setCardStyle({}); return; }
      target.classList.add("tour-highlight");
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      window.setTimeout(() => {
        const rect = target.getBoundingClientRect();
        const width = Math.min(390, window.innerWidth - 28);
        const left = rect.right + width + 20 < window.innerWidth
          ? rect.right + 14
          : rect.left - width - 14 > 8 ? rect.left - width - 14 : Math.max(10, (window.innerWidth - width) / 2);
        const top = Math.max(86, Math.min(window.innerHeight - 390, rect.top + rect.height / 2 - 170));
        setCardStyle({ left, top, bottom: "auto" });
      }, reduceMotion ? 0 : 320);
    };
    const timer = window.setTimeout(locate, screen === current.screen ? 30 : 180);
    return () => { window.clearTimeout(timer); document.querySelector(`[data-tour="${current.target}"]`)?.classList.remove("tour-highlight"); };
  }, [current.screen, current.target, onNavigate, open, screen]);

  useEffect(() => {
    if (!open) return;
    cardRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(false);
      if (event.key === "ArrowLeft" && step > 0) setStep((value) => value - 1);
      if (event.key === "ArrowRight") {
        if (last) close(true);
        else setStep((value) => value + 1);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  if (!open) return null;
  return (
    <aside ref={cardRef} className="tour-card" style={cardStyle} role="dialog" aria-modal="false" aria-label={`Recorrido guiado: ${current.title}`} tabIndex={-1}>
      <div className="tour-via"><ViaAvatar state={step === 0 ? "greeting" : last ? "celebration" : current.state ?? "talking"} size={86} /><div><b>Vía te acompaña</b><small>Recorrido para {role === "volunteer" ? "voluntarios" : "organizaciones"}</small></div></div>
      <div className="tutorial-progress" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }} aria-label={`Paso ${step + 1} de ${steps.length}`}>{steps.map((item, index) => <i key={`${item.target}-${index}`} className={index <= step ? "active" : ""} />)}</div>
      <span className="tutorial-step">Paso {step + 1} de {steps.length}</span>
      <h2>{current.title}</h2>
      <p aria-live="polite">{typewriter.visibleText}<span className="typewriter-cursor" aria-hidden="true" /></p>
      {!typewriter.complete && <button className="typewriter-skip" onClick={typewriter.showAll}>Mostrar todo el texto</button>}
      <div className="tour-actions"><Button variant="ghost" onClick={() => close(false)}>Omitir tutorial</Button>{step > 0 && <Button variant="outline" onClick={() => setStep((value) => value - 1)}>Anterior</Button>}<Button onClick={() => last ? close(true) : setStep((value) => value + 1)}>{last ? role === "volunteer" ? "Finalizar y preguntarle a Vía" : "Finalizar" : "Siguiente"}</Button></div>
    </aside>
  );
}
