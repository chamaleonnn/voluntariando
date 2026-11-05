import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import OpenAI from "openai";

const openAiKey = defineSecret("OPENAI_API_KEY");

// HU-07 y HU-09: la IA detecta relaciones semánticas y explica, pero no cambia el porcentaje.
export const analyzeSemanticCompatibility = onCall({
  region: "southamerica-east1",
  secrets: [openAiKey],
  cors: true,
}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Debés iniciar sesión.");
  const { profile, opportunity } = request.data ?? {};
  if (!profile || !opportunity) throw new HttpsError("invalid-argument", "Faltan datos del perfil o de la oportunidad.");

  const client = new OpenAI({ apiKey: openAiKey.value() });
  const volunteer = {
    interests: profile.interests ?? [], declaredSkills: profile.declaredSkills ?? [],
    verifiedSkills: Object.keys(profile.verifiedSkills ?? {}), availability: profile.availability ?? [],
    location: profile.location ?? "",
    experiences: (profile.experiences ?? []).flatMap((item) => [...(item.tasks ?? []), ...(item.skills ?? [])]),
  };
  const target = {
    category: opportunity.category ?? "", tasks: opportunity.tasks ?? [],
    requiredSkills: opportunity.requiredSkills ?? [], availability: opportunity.availability ?? [],
    province: opportunity.province ?? "", neighborhood: opportunity.neighborhood ?? "", modality: opportunity.modality ?? "",
  };
  const response = await client.responses.create({
    model: "gpt-5-mini",
    max_output_tokens: 350,
    text: {
      format: {
        type: "json_schema",
        name: "semantic_compatibility",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            relationships: {
              type: "array",
              maxItems: 5,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  profileEvidence: { type: "string" },
                  opportunityEvidence: { type: "string" },
                  relation: { type: "string" },
                },
                required: ["profileEvidence", "opportunityEvidence", "relation"],
              },
            },
          },
          required: ["relationships"],
        },
      },
    },
    input: [
      {
        role: "system",
        content: "Identificá relaciones semánticas respaldadas por los datos recibidos. profileEvidence y opportunityEvidence deben copiar literalmente valores presentes en la entrada. No inventes datos y no calcules porcentajes. relation debe ser una frase breve en español argentino.",
      },
      {
        role: "user",
        content: JSON.stringify({ volunteer, opportunity: target }),
      },
    ],
  });
  const parsed = JSON.parse(response.output_text);
  const profileEvidence = new Set(Object.values(volunteer).flat(Infinity).map(String));
  const opportunityEvidence = new Set(Object.values(target).flat(Infinity).map(String));
  const relationships = (parsed.relationships ?? []).filter((item) =>
    profileEvidence.has(item.profileEvidence) && opportunityEvidence.has(item.opportunityEvidence),
  );
  const explanation = relationships.length
    ? `La IA encontró relaciones entre ${relationships.slice(0, 3).map((item) => `${item.profileEvidence} y ${item.opportunityEvidence}`).join(", ")}.`
    : "La IA no encontró relaciones adicionales respaldadas por los datos disponibles.";
  return { relationships, explanation };
});
