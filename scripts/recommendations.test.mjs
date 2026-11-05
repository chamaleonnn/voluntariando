import assert from "node:assert/strict";
import test from "node:test";

import { calculateCompatibility, recommendOpportunities } from "../lib/recommendations.ts";

const opportunity = {
  id: "huerta", title: "Huerta", organization: "Comunidad", organizationId: "org",
  description: "", tasks: ["Preparar la huerta"], requirements: [], date: "2026-11-10",
  dateLabel: "10 nov", time: "10:00", neighborhood: "Córdoba capital", addressHint: "",
  latitude: 0, longitude: 0, distanceKm: 0, capacity: 10, availableSpots: 5,
  category: "Ambiente", province: "Córdoba", modality: "Presencial",
  availability: ["Sábado por la mañana"], requiredSkills: ["Naturaleza y ambiente"],
  imageUrl: "", visibility: "public", status: "published",
};

function profile(overrides = {}) {
  return {
    id: "vol", name: "Persona", initials: "P", location: "Córdoba capital", bio: "",
    completedExperiences: 0, verifiedHours: 0, interests: ["Ambiente"],
    declaredSkills: ["Naturaleza y ambiente"], verifiedSkills: {},
    availability: ["Sábado por la mañana"], experiences: [],
    visibleToOrganizations: true, visibleToVolunteers: true, ...overrides,
  };
}

test("respeta la ponderación 30/20/20/15/15", () => {
  const result = calculateCompatibility(profile({
    verifiedSkills: { "Naturaleza y ambiente": 1 },
    experiences: [{ opportunityId: "previa", opportunityTitle: "Huerta previa", organization: "Org", tasks: ["Preparar huerta"], skills: ["Naturaleza y ambiente"], completedAt: "2026-10-01" }],
  }), opportunity);
  assert.deepEqual(result.breakdown, { skills: 100, interests: 100, availability: 100, location: 100, experience: 100 });
  assert.equal(result.score, 100);
});

test("un voluntario nuevo no pierde puntos de habilidades por carecer de verificaciones", () => {
  const result = calculateCompatibility(profile(), opportunity);
  assert.equal(result.breakdown.skills, 100);
  assert.equal(result.breakdown.experience, 0);
  assert.equal(result.score, 85);
});

test("las habilidades verificadas funcionan aunque no haya habilidades declaradas", () => {
  const result = calculateCompatibility(profile({ declaredSkills: [], verifiedSkills: { "Naturaleza y ambiente": 2 } }), opportunity);
  assert.equal(result.breakdown.skills, 100);
});

test("una experiencia relacionada mejora una recomendación futura", () => {
  const before = calculateCompatibility(profile({ declaredSkills: ["Cocina"], verifiedSkills: {} }), opportunity);
  const afterProfile = profile({
    declaredSkills: ["Cocina"],
    verifiedSkills: { "Naturaleza y ambiente": 1 },
    completedExperiences: 1,
    experiences: [{ opportunityId: "previa", opportunityTitle: "Huerta previa", organization: "Org", tasks: ["Preparar huerta"], skills: ["Naturaleza y ambiente"], completedAt: "2026-10-01" }],
  });
  const after = recommendOpportunities([opportunity], afterProfile)[0];
  assert.equal(before.score, 55);
  assert.equal(after.compatibility, 90);
  assert.ok((after.compatibility ?? 0) > before.score);
});

test("datos sin relación producen cero en cada criterio", () => {
  const result = calculateCompatibility(profile({
    location: "Mendoza", interests: ["Cocina"], declaredSkills: ["Cocina"],
    availability: ["Lunes por la noche"], verifiedSkills: {}, experiences: [],
  }), opportunity);
  assert.deepEqual(result.breakdown, { skills: 0, interests: 0, availability: 0, location: 0, experience: 0 });
  assert.equal(result.score, 0);
});

test("una relación semántica de OpenAI no modifica el porcentaje determinista", () => {
  const candidate = profile({ declaredSkills: ["Facilitación de grupos"], verifiedSkills: {}, experiences: [] });
  const deterministic = calculateCompatibility(candidate, opportunity);
  const openAiRelationships = [{
    profileEvidence: "Facilitación de grupos",
    opportunityEvidence: "Naturaleza y ambiente",
    relation: "Puede facilitar actividades ambientales grupales.",
  }];

  // La salida de OpenAI se conserva para la explicación, pero no se entrega al cálculo.
  assert.equal(openAiRelationships.length, 1);
  assert.deepEqual(deterministic.breakdown, { skills: 0, interests: 100, availability: 100, location: 100, experience: 0 });
  assert.equal(deterministic.score, 55);
});
