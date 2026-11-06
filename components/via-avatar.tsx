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
          <path className="via-scarf-band" d="M12 9c25 20 65 23 95 2l5 17c-33 24-77 24-107-2z" />
          <path className="via-scarf-tip" d="m59 35-18 43 23-16 7-28z" />
          <path className="via-scarf-tip via-scarf-tip-right" d="m66 36 12 44 14-24-12-27z" />
          <path className="via-scarf-knot" d="M52 30c8-6 22-5 29 2l-5 18c-8 5-18 4-25-2z" />
        </svg>
      </span>
      {symbol && <i aria-hidden="true">{symbol}</i>}
    </span>
  );
}
