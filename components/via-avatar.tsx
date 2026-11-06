"use client";

import Image from "next/image";

export type ViaState = "idle" | "greeting" | "talking" | "explanation" | "waiting" | "thinking" | "celebration" | "farewell";

type ViaAvatarProps = {
  state?: ViaState;
  size?: number;
  label?: string;
  className?: string;
};

// El PNG original nunca se modifica: las expresiones y el pañuelito son capas
// livianas que se escalan junto con el mismo Vía en todos sus tamaños.
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
      <Image src="/via-mecha.png" width={size} height={size} alt="" priority={size >= 180} />
      <span className="via-eye via-eye-left" aria-hidden="true" />
      <span className="via-eye via-eye-right" aria-hidden="true" />
      <span className="via-mouth" aria-hidden="true" />
      <span className="via-scarf" aria-hidden="true">
        <svg viewBox="0 0 140 92" focusable="false">
          <path className="via-scarf-band" d="M8 15c34 23 85 25 124-3l3 17C94 58 42 56 6 32z" />
          <path className="via-scarf-fold" d="M14 20c36 19 79 21 112-2-31 29-79 31-112 2z" />
          <path className="via-scarf-tip" d="m73 43-15 41 20-15 5-30z" />
          <path className="via-scarf-tip via-scarf-tip-right" d="m80 43 12 39 14-23-15-25z" />
          <path className="via-scarf-knot" d="M67 36c8-6 20-5 27 1l-5 18c-8 6-16 5-24-1z" />
        </svg>
      </span>
      {symbol && <i aria-hidden="true">{symbol}</i>}
    </span>
  );
}
