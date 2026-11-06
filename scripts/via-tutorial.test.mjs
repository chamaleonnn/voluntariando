import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { VIA_TOUR_STEPS, VIA_VIDEO_STEPS, VIA_WELCOME_DIALOGUES, viaTutorialStorageKey, viaWelcomeStorageKey } from "../lib/via-tutorial.ts";

const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

test("los recorridos de ambos roles apuntan a componentes reales", () => {
  for (const [role, steps] of Object.entries(VIA_TOUR_STEPS)) {
    assert.ok(steps.length >= 6, `${role} debe tener un recorrido completo`);
    for (const step of steps) {
      assert.match(pageSource, new RegExp(`data-tour=["']${step.target}["']`), `falta el destino ${step.target}`);
      if (step.actionTarget) assert.match(pageSource, new RegExp(`data-tour-action=["']${step.actionTarget}["']`), `falta la acción real ${step.actionTarget}`);
      assert.ok(step.title && step.text, "cada etapa debe tener título y explicación");
    }
  }
});

test("la bienvenida narrativa y las acciones reales existen para ambos roles", () => {
  for (const role of ["volunteer", "organization"]) {
    assert.equal(VIA_WELCOME_DIALOGUES[role].length, 3);
    assert.ok(VIA_WELCOME_DIALOGUES[role].some((item) => item.state === "greeting"));
    assert.ok(VIA_TOUR_STEPS[role].filter((item) => item.actionTarget).length >= 2);
  }
});

test("los cuatro videos y sus respaldos existen", () => {
  assert.equal(VIA_VIDEO_STEPS.length, 4);
  for (const step of VIA_VIDEO_STEPS) {
    const name = step.videoSrc.split("/").at(-1);
    assert.ok(name);
    assert.equal(existsSync(new URL(`../public${step.videoSrc}`, import.meta.url)), true, `falta ${name}`);
    assert.equal(existsSync(new URL(`../public/videos/originales/${name}`, import.meta.url)), true, `falta el respaldo de ${name}`);
  }
});

test("las claves de persistencia son estables y separadas por rol", () => {
  assert.equal(viaWelcomeStorageKey("usuario-1"), "voluntariando-via-welcome-usuario-1-v3");
  assert.notEqual(viaTutorialStorageKey("usuario-1", "volunteer"), viaTutorialStorageKey("usuario-1", "organization"));
});

test("la variante integrada de Vía y el original permanecen disponibles", () => {
  assert.equal(existsSync(new URL("../public/via-mecha.png", import.meta.url)), true);
  assert.equal(existsSync(new URL("../public/via-mecha-scout.png", import.meta.url)), true);
});
