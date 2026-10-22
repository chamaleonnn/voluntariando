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
  const response = await client.responses.create({
    model: "gpt-5-mini",
    max_output_tokens: 180,
    input: [
      {
        role: "system",
        content: "Analizá compatibilidad de voluntariado. Identificá solamente relaciones semánticas respaldadas por los datos recibidos. No inventes habilidades ni experiencias y no calcules ni modifiques porcentajes. Respondé en español argentino con una explicación breve.",
      },
      {
        role: "user",
        content: JSON.stringify({
          volunteer: {
            interests: profile.interests ?? [], declaredSkills: profile.declaredSkills ?? [],
            verifiedSkills: profile.verifiedSkills ?? {}, availability: profile.availability ?? [],
            location: profile.location ?? "", experiences: profile.experiences ?? [],
          },
          opportunity: {
            category: opportunity.category ?? "", tasks: opportunity.tasks ?? [],
            requiredSkills: opportunity.requiredSkills ?? [], availability: opportunity.availability ?? [],
            province: opportunity.province ?? "", modality: opportunity.modality ?? "",
          },
        }),
      },
    ],
  });
  return { explanation: response.output_text };
});
