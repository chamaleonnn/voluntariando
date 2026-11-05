import { httpsCallable } from "firebase/functions";

import { functions } from "@/lib/firebase";
import type { Opportunity, VolunteerProfile } from "@/lib/types";
import type { SemanticRelationship } from "@/lib/recommendations";

export type SemanticAnalysis = {
  explanation: string;
  relationships: SemanticRelationship[];
};

const analysisCache = new Map<string, Promise<SemanticAnalysis>>();

// La IA solo aporta relaciones y explicación. El porcentaje sigue en el motor reproducible local.
export async function analyzeSemanticCompatibility(profile: VolunteerProfile, opportunity: Opportunity) {
  if (!functions) throw new Error("La integración con IA no está disponible en este entorno.");
  const cacheKey = JSON.stringify({
    profile: { interests: profile.interests, declaredSkills: profile.declaredSkills, verifiedSkills: profile.verifiedSkills, availability: profile.availability, location: profile.location, experiences: profile.experiences },
    opportunity: { id: opportunity.id, category: opportunity.category, tasks: opportunity.tasks, requiredSkills: opportunity.requiredSkills, availability: opportunity.availability, province: opportunity.province, neighborhood: opportunity.neighborhood, modality: opportunity.modality },
  });
  const cached = analysisCache.get(cacheKey);
  if (cached) return cached;
  const callable = httpsCallable<{ profile: VolunteerProfile; opportunity: Opportunity }, SemanticAnalysis>(functions, "analyzeSemanticCompatibility");
  const request = callable({ profile, opportunity }).then((result) => result.data);
  analysisCache.set(cacheKey, request);
  try { return await request; }
  catch (error) { analysisCache.delete(cacheKey); throw error; }
}
