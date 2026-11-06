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
        <svg viewBox="0 0 120 88" focusable="false">
          <path className="via-scarf-band" d="M10 15c28 17 66 19 99-2l3 12C79 47 39 44 9 28z" />
          <path className="via-scarf-tip" d="m60 37-8 35 13-11 4-25z" />
          <path className="via-scarf-tip via-scarf-tip-right" d="m68 37 7 33 10-17-8-20z" />
          <path className="via-scarf-knot" d="M57 31c6-4 15-3 20 1l-3 13c-6 4-12 3-18-1z" />
        </svg>
      </span>
      {symbol && <i aria-hidden="true">{symbol}</i>}
    </span>
  );
}
