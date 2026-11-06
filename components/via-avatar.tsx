"use client";

import Image from "next/image";

export type ViaState = "idle" | "greeting" | "talking" | "explanation" | "waiting" | "thinking" | "celebration" | "farewell";

type ViaAvatarProps = {
  state?: ViaState;
  size?: number;
  label?: string;
  className?: string;
};

// El PNG original se conserva como respaldo. Esta variante integra el pañuelo
// dentro del render para respetar la textura, la profundidad y la sonrisa.
export function ViaAvatar({ state = "idle", size = 76, label = "Vía, asistente de Voluntariando", className = "" }: ViaAvatarProps) {
  const symbol = state === "thinking" ? "···" : state === "celebration" ? "✦" : state === "greeting" ? "¡Hola!" : state === "explanation" ? "i" : "";

  return (
    <span
      className={`via-avatar via-${state} ${className}`.trim()}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
      data-via-state={state}
    >
      <Image src="/via-mecha-scout.png" width={size} height={size} alt="" priority={size >= 180} />
      <span className="via-eye via-eye-left" aria-hidden="true" />
      <span className="via-eye via-eye-right" aria-hidden="true" />
      <span className="via-mouth" aria-hidden="true" />
      {symbol && <i aria-hidden="true">{symbol}</i>}
    </span>
  );
}
