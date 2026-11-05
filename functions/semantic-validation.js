// Conserva únicamente relaciones cuyas evidencias existen literalmente en la entrada.
export function validateSemanticRelationships(parsed, volunteer, opportunity) {
  const profileEvidence = new Set(Object.values(volunteer).flat(Infinity).map(String));
  const opportunityEvidence = new Set(Object.values(opportunity).flat(Infinity).map(String));
  const source = Array.isArray(parsed?.relationships) ? parsed.relationships : [];
  return source.slice(0, 5).filter((item) =>
    item
    && typeof item.profileEvidence === "string"
    && typeof item.opportunityEvidence === "string"
    && typeof item.relation === "string"
    && profileEvidence.has(item.profileEvidence)
    && opportunityEvidence.has(item.opportunityEvidence)
  );
}

export function explainSemanticRelationships(relationships) {
  return relationships.length
    ? `La IA encontró relaciones entre ${relationships.slice(0, 3).map((item) => `${item.profileEvidence} y ${item.opportunityEvidence}`).join(", ")}.`
    : "La IA no encontró relaciones adicionales respaldadas por los datos disponibles.";
}
