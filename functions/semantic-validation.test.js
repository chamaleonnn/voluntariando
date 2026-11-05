import assert from "node:assert/strict";
import test from "node:test";

import { explainSemanticRelationships, validateSemanticRelationships } from "./semantic-validation.js";

const volunteer = { interests: ["Ambiente"], declaredSkills: ["Trabajo en equipo"] };
const opportunity = { category: "Huerta", requiredSkills: ["Naturaleza y ambiente"] };

test("acepta evidencia literal presente en ambos lados", () => {
  const relationships = validateSemanticRelationships({ relationships: [{
    profileEvidence: "Ambiente",
    opportunityEvidence: "Huerta",
    relation: "El interés ambiental se relaciona con la huerta.",
  }] }, volunteer, opportunity);
  assert.equal(relationships.length, 1);
  assert.match(explainSemanticRelationships(relationships), /Ambiente y Huerta/);
});

test("descarta evidencia inventada o estructuras inválidas", () => {
  const relationships = validateSemanticRelationships({ relationships: [
    { profileEvidence: "Pintura", opportunityEvidence: "Huerta", relation: "Inventada" },
    { profileEvidence: "Ambiente", opportunityEvidence: "Hospital", relation: "Inventada" },
    { profileEvidence: "Ambiente", opportunityEvidence: "Huerta" },
  ] }, volunteer, opportunity);
  assert.deepEqual(relationships, []);
  assert.match(explainSemanticRelationships(relationships), /no encontró relaciones/);
});
