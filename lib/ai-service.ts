import { httpsCallable } from "firebase/functions";

import { functions } from "@/lib/firebase";
import type { Opportunity, VolunteerProfile } from "@/lib/types";

export type SemanticAnalysis = {
  explanation: string;
  relationships: Array<{
    profileEvidence: string;
    opportunityEvidence: string;
    relation: string;
  }>;
};

// La IA solo aporta relaciones y explicación. El porcentaje sigue en el motor reproducible local.
export async function analyzeSemanticCompatibility(profile: VolunteerProfile, opportunity: Opportunity) {
  if (!functions) throw new Error("La integración con IA no está disponible en este entorno.");
  const callable = httpsCallable<{ profile: VolunteerProfile; opportunity: Opportunity }, SemanticAnalysis>(functions, "analyzeSemanticCompatibility");
  const result = await callable({ profile, opportunity });
  return result.data;
}
