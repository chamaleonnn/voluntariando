"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, Check, MousePointer2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ViaAvatar } from "@/components/via-avatar";
import { VIA_TOUR_STEPS, VIA_VIDEO_STEPS, VIA_WELCOME_DIALOGUES, type TutorialRole, type TutorialScreen } from "@/lib/via-tutorial";

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
  const dialogues = VIA_WELCOME_DIALOGUES[role];
  const [step, setStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const inDialogue = step < dialogues.length;
  const videoIndex = step - dialogues.length;
  const currentVideo = VIA_VIDEO_STEPS[Math.max(0, videoIndex)];
  const lastVideo = videoIndex === VIA_VIDEO_STEPS.length - 1;
  const message = inDialogue ? dialogues[step].text : currentVideo.text;
  const typewriter = useTypewriter(message, open);

  function omit() { setStep(0); setTransitioning(false); onOmit(); }
  const modalRef = useModalFocus(open, omit);

  function nextDialogue() {
    if (!typewriter.complete) return typewriter.showAll();
    setStep((value) => value + 1);
  }

  function startTour() {
    setTransitioning(true);
    window.setTimeout(() => {
      setStep(0);
      setTransitioning(false);
      onStartTour();
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 820);
  }

  if (!open) return null;
  return (
    <div className={`via-welcome-backdrop ${transitioning ? "is-shrinking" : ""}`}>
      <section ref={modalRef} className={`via-welcome ${inDialogue ? "story" : "video"}`} role="dialog" aria-modal="true" aria-labelledby="via-welcome-title">
        {inDialogue ? <>
          <div className="via-scene-light" aria-hidden="true" />
          <div className="via-welcome-character" data-scene-step={step}><ViaAvatar state={dialogues[step].state} size={390} /></div>
          <div className="via-dialogue-box">
            <span><Sparkles /> Vía · tu guía</span>
            <h1 id="via-welcome-title">{step === 0 ? "Una nueva experiencia comienza" : role === "volunteer" ? "Encontremos tu forma de ayudar" : "Hagamos crecer cada oportunidad"}</h1>
            <p aria-live="polite">{typewriter.visibleText}<span className="typewriter-cursor" aria-hidden="true" /></p>
            <div className="via-dialogue-controls">
              <Button variant="ghost" onClick={omit}>Omitir tutorial</Button>
              <Button size="lg" onClick={nextDialogue}>{!typewriter.complete ? "Mostrar mensaje" : step === dialogues.length - 1 ? "Ver cómo funciona" : "Continuar"} <ArrowRight /></Button>
            </div>
            <div className="via-dialogue-dots" aria-label={`Mensaje ${step + 1} de ${dialogues.length}`}>{dialogues.map((item, index) => <i key={item.text} className={index <= step ? "active" : ""} />)}</div>
          </div>
        </> : <>
          <div className="via-welcome-video"><video key={currentVideo.videoSrc} src={currentVideo.videoSrc} controls muted playsInline preload="metadata">Tu navegador no puede reproducir este video.</video></div>
          <div className="via-welcome-explanation"><ViaAvatar state={lastVideo ? "celebration" : "talking"} size={160} /><div><span>Vía explica · {videoIndex + 1} de {VIA_VIDEO_STEPS.length}</span><h2 id="via-welcome-title">{currentVideo.title}</h2><p aria-live="polite">{typewriter.visibleText}<span className="typewriter-cursor" aria-hidden="true" /></p>{!typewriter.complete && <button className="typewriter-skip" onClick={typewriter.showAll}>Mostrar todo el texto</button>}</div></div>
          <div className="via-welcome-progress" aria-label={`Video ${videoIndex + 1} de ${VIA_VIDEO_STEPS.length}`}>{VIA_VIDEO_STEPS.map((item, index) => <i key={item.title} className={index <= videoIndex ? "active" : ""} />)}</div>
          <div className="via-welcome-actions"><Button variant="ghost" onClick={omit}>Omitir tutorial</Button>{videoIndex > 0 && <Button variant="outline" onClick={() => setStep((value) => value - 1)}>Anterior</Button>}<Button onClick={() => lastVideo ? startTour() : setStep((value) => value + 1)}>{lastVideo ? "Recorrer la app con Vía" : "Siguiente"}</Button></div>
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
  const [actionComplete, setActionComplete] = useState(false);
  const [finale, setFinale] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const steps = useMemo(() => VIA_TOUR_STEPS[role], [role]);
  const current = steps[step];
  const last = step === steps.length - 1;
  const finaleMessage = role === "volunteer"
    ? "¡Recorrido completado! Ya conocés las herramientas principales. Cuando quieras, puedo ayudarte a encontrar una oportunidad para vos."
    : "¡Recorrido completado! Ya conocés las herramientas principales. Voy a seguir cerca para acompañar a tu organización.";
  const typewriter = useTypewriter(finale ? finaleMessage : current.text, open);

  function cleanHighlights() {
    document.querySelectorAll(".tour-highlight, .tour-action-highlight").forEach((item) => item.classList.remove("tour-highlight", "tour-action-highlight"));
  }

  function close(completed: boolean) {
    cleanHighlights();
    setStep(0);
    setFinale(false);
    setLeaving(false);
    setActionComplete(false);
    onOpenChange(false);
    onFinish(completed && role === "volunteer");
  }

  function finishWithFarewell() {
    if (!typewriter.complete) return typewriter.showAll();
    setLeaving(true);
    window.setTimeout(() => close(true), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 850);
  }

  function advance() {
    if (current.actionTarget && !actionComplete) return;
    setActionComplete(false);
    if (last) setFinale(true);
    else setStep((value) => value + 1);
  }

  function performAction() {
    if (!current.actionTarget) return advance();
    const action = document.querySelector<HTMLElement>(`[data-tour-action="${current.actionTarget}"]`);
    if (!action) return;
    if (action.hasAttribute("disabled")) {
      setActionComplete(true);
      return;
    }
    action.focus({ preventScroll: true });
    if (!(action instanceof HTMLInputElement)) action.click();
  }

  useEffect(() => {
    if (!open || finale) return;
    if (screen !== current.screen) onNavigate(current.screen);
    let attempts = 0;
    let action: HTMLElement | null = null;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const completed = () => setActionComplete(true);
    const locate = () => {
      const target = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`);
      action = current.actionTarget ? document.querySelector<HTMLElement>(`[data-tour-action="${current.actionTarget}"]`) : null;
      if ((!target || (current.actionTarget && !action)) && attempts++ < 14) return window.setTimeout(locate, 120);
      cleanHighlights();
      if (!target) { setCardStyle({}); return; }
      target.classList.add("tour-highlight");
      action?.classList.add("tour-action-highlight");
      action?.addEventListener(action instanceof HTMLInputElement ? "focus" : "click", completed, { once: true });
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      window.setTimeout(() => {
        const rect = target.getBoundingClientRect();
        const width = Math.min(390, window.innerWidth - 28);
        const left = rect.right + width + 20 < window.innerWidth
          ? rect.right + 14
          : rect.left - width - 14 > 8 ? rect.left - width - 14 : Math.max(10, (window.innerWidth - width) / 2);
        const top = Math.max(86, Math.min(window.innerHeight - 430, rect.top + rect.height / 2 - 190));
        setCardStyle({ left, top, bottom: "auto" });
      }, reduceMotion ? 0 : 320);
    };
    const timer = window.setTimeout(locate, screen === current.screen ? 30 : 180);
    return () => {
      window.clearTimeout(timer);
      action?.removeEventListener(action instanceof HTMLInputElement ? "focus" : "click", completed);
      cleanHighlights();
    };
  }, [current.actionTarget, current.screen, current.target, finale, onNavigate, open, screen]);

  useEffect(() => {
    if (!open) return;
    cardRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(false);
      if (!finale && event.key === "ArrowLeft" && step > 0) { setActionComplete(false); setStep((value) => value - 1); }
      if (!finale && event.key === "ArrowRight" && (!current.actionTarget || actionComplete)) advance();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  if (!open) return null;
  if (finale) return (
    <div className={`via-finale-backdrop ${leaving ? "is-leaving" : ""}`}>
      <section ref={cardRef} className="via-finale-scene" role="dialog" aria-modal="true" aria-labelledby="via-finale-title" tabIndex={-1}>
        <ViaAvatar state={leaving ? "farewell" : "celebration"} size={350} />
        <div className="via-finale-dialogue"><span><Sparkles /> Misión completada</span><h2 id="via-finale-title">¡Ya estás listo para empezar!</h2><p aria-live="polite">{typewriter.visibleText}<span className="typewriter-cursor" aria-hidden="true" /></p><Button size="lg" onClick={finishWithFarewell}>{typewriter.complete ? "Seguir explorando" : "Mostrar mensaje"} <ArrowRight /></Button></div>
      </section>
    </div>
  );

  const viaState = actionComplete ? "celebration" : step === 0 ? "greeting" : current.state ?? "talking";
  return (
    <aside ref={cardRef} className={`tour-card ${actionComplete ? "is-success" : ""}`} style={cardStyle} role="dialog" aria-modal="false" aria-label={`Recorrido guiado: ${current.title}`} tabIndex={-1}>
      <div className="tour-via"><ViaAvatar state={viaState} size={112} /><div><b>{actionComplete ? "¡Eso es!" : "Vía te acompaña"}</b><small>{actionComplete ? "Paso reconocido" : `Recorrido para ${role === "volunteer" ? "voluntarios" : "organizaciones"}`}</small></div></div>
      <div className="tutorial-progress" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }} aria-label={`Paso ${step + 1} de ${steps.length}`}>{steps.map((item, index) => <i key={`${item.target}-${index}`} className={index <= step ? "active" : ""} />)}</div>
      <span className="tutorial-step">Paso {step + 1} de {steps.length}</span>
      <h2>{current.title}</h2>
      <p aria-live="polite">{actionComplete ? "¡Bien hecho! Ya sabés dónde encontrar esta herramienta." : typewriter.visibleText}<span className="typewriter-cursor" aria-hidden="true" /></p>
      {!typewriter.complete && !actionComplete && <button className="typewriter-skip" onClick={typewriter.showAll}>Mostrar todo el texto</button>}
      {current.actionTarget && !actionComplete && <div className="tour-action-prompt"><MousePointer2 /><div><b>Tu turno</b><small>{current.actionHint}</small></div></div>}
      <div className="tour-actions">
        <Button variant="ghost" onClick={() => close(false)}>Omitir</Button>
        {step > 0 && <Button variant="outline" onClick={() => { setActionComplete(false); setStep((value) => value - 1); }}>Anterior</Button>}
        {current.actionTarget && !actionComplete
          ? <Button onClick={performAction}>{current.actionLabel}</Button>
          : <Button onClick={advance}>{actionComplete ? <><Check /> Continuar</> : last ? "Completar recorrido" : "Siguiente parada"}</Button>}
      </div>
    </aside>
  );
}

export function ViaMilestoneCelebration({ role, open, onClose }: { role: TutorialRole; open: boolean; onClose: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const message = role === "volunteer"
    ? "¡Eh, felicitaciones! Estoy muy contento porque lograste tu primera vinculación y convertiste tus ganas de ayudar en una experiencia real. Este es el comienzo de algo muy lindo."
    : "¡Eh, felicitaciones! Estoy muy contento porque le brindaron a alguien la oportunidad de ayudar, aprender y mejorar el mundo junto a ustedes. Gracias por abrir ese espacio.";
  const typewriter = useTypewriter(message, open);
  const modalRef = useModalFocus(open, onClose);

  function finish() {
    if (!typewriter.complete) return typewriter.showAll();
    setLeaving(true);
    window.setTimeout(() => {
      setLeaving(false);
      onClose();
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 800);
  }

  if (!open) return null;
  return (
    <div className={`via-milestone-backdrop ${leaving ? "is-leaving" : ""}`}>
      <section ref={modalRef} className="via-milestone-scene" role="dialog" aria-modal="true" aria-labelledby="via-milestone-title">
        <div className="via-milestone-sparkles" aria-hidden="true"><i>✦</i><i>✧</i><i>✦</i></div>
        <ViaAvatar state={leaving ? "farewell" : "celebration"} size={380} />
        <div className="via-milestone-dialogue">
          <span><Sparkles /> Un momento para celebrar</span>
          <h2 id="via-milestone-title">{role === "volunteer" ? "¡Tu primera experiencia!" : "¡La primera experiencia que hicieron posible!"}</h2>
          <p aria-live="polite">{typewriter.visibleText}<span className="typewriter-cursor" aria-hidden="true" /></p>
          <Button size="lg" onClick={finish}>{typewriter.complete ? "Seguir construyendo comunidad" : "Escuchar a Vía"} <ArrowRight /></Button>
        </div>
      </section>
    </div>
  );
}
