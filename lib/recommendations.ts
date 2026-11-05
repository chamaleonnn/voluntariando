import type { Opportunity, VolunteerProfile } from "@/lib/types";

type Breakdown = NonNullable<Opportunity["compatibilityBreakdown"]>;
export type SemanticRelationship = {
  profileEvidence: string;
  opportunityEvidence: string;
  relation: string;
};

const semanticGroups = [
  ["educación", "enseñanza", "apoyo escolar", "acompañamiento educativo"],
  ["ambiente", "naturaleza", "huerta", "plantación", "reforestación", "compost"],
  ["arte", "creatividad", "pintura", "mural", "diseño"],
  ["alimentación", "cocina", "comedor", "nutrición"],
  ["tecnología", "informática", "computación", "digital"],
  ["construcción", "reparación", "mantenimiento", "herramientas"],
];

function normalize(value: string) {
  return value.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function related(left: string, right: string) {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  return semanticGroups.some((group) => {
    const normalized = group.map(normalize);
    return normalized.some((term) => a.includes(term)) && normalized.some((term) => b.includes(term));
  });
}

function overlap(source: string[], target: string[]) {
  if (!target.length) return 0;
  const hits = target.filter((item) => source.some((candidate) => related(candidate, item))).length;
  return Math.round((hits / target.length) * 100);
}

export function calculateCompatibility(profile: VolunteerProfile, opportunity: Opportunity): { score: number; breakdown: Breakdown; explanation: string } {
  const declared = profile.declaredSkills ?? [];
  const verified = Object.entries(profile.verifiedSkills ?? {})
    .filter(([, count]) => count > 0)
    .map(([skill]) => skill);
  const required = opportunity.requiredSkills ?? [];

  // Si existen ambas fuentes, lo verificado pesa más. Un perfil nuevo no es castigado por no tener experiencia todavía.
  const declaredScore = overlap(declared, required);
  const verifiedScore = overlap(verified, required);
  const skills = !required.length
    ? 100
    : declared.length && verified.length
      ? Math.round(declaredScore * 0.35 + verifiedScore * 0.65)
      : verified.length ? verifiedScore : declaredScore;
  const interests = overlap(profile.interests, [opportunity.category]);
  const availability = overlap(profile.availability ?? [], opportunity.availability ?? []);
  const location = opportunity.modality === "Virtual"
    ? 100
    : related(profile.location, opportunity.province) || related(profile.location, opportunity.neighborhood)
      ? 100
      : opportunity.modality === "Híbrida" ? 60 : 0;
  const experienceText = (profile.experiences ?? []).flatMap((item) => [...item.tasks, ...item.skills]);
  const experience = overlap(experienceText, [...required, opportunity.category]);

  const breakdown = { skills, interests, availability, location, experience };
  const score = Math.round(
    skills * 0.30
    + interests * 0.20
    + availability * 0.20
    + location * 0.15
    + experience * 0.15,
  );

  const factors: string[] = [];
  if (verifiedScore > 0) factors.push("habilidades verificadas en experiencias anteriores");
  else if (declaredScore > 0) factors.push("habilidades declaradas");
  if (interests > 0) factors.push(`tu interés en ${opportunity.category}`);
  if (availability > 0) factors.push("disponibilidad compatible");
  if (location > 0) factors.push(opportunity.modality === "Virtual" ? "modalidad virtual" : "ubicación compatible");
  if (experience > 0) factors.push("experiencias relacionadas");

  const explanation = factors.length
    ? `La recomendación se basa en ${factors.slice(0, 3).join(", ")}.`
    : "Todavía faltan coincidencias suficientes para explicar esta recomendación.";
  return { score, breakdown, explanation };
}

// HU-06 a HU-09: calcula 0-100, ordena y explica sin inventar datos.
export function recommendOpportunities(items: Opportunity[], profile: VolunteerProfile | null) {
  if (!profile) return items;
  return items
    .map((opportunity) => {
      const result = calculateCompatibility(profile, opportunity);
      return {
        ...opportunity,
        compatibility: result.score,
        compatibilityBreakdown: result.breakdown,
        recommendedBecause: result.explanation,
      };
    })
    .sort((a, b) => (b.compatibility ?? 0) - (a.compatibility ?? 0));
}
