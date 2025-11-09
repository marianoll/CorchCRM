'use server';

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

/* ---------- Schemas (solo acciones concretas) ---------- */

const ActionSchema = z.object({
  type: z.enum([
    'update_entity','create_entity','create_task','create_ai_draft',
    'create_meeting','notify_user'
  ]),
  target: z.enum([
    'companies','contacts','deals','emails','tasks','ai_drafts','meetings','notifications'
  ]),
  id: z.string().optional(),              // para update_*
  data: z.record(z.any()).optional(),     // para create_*
  changes: z.record(z.any()).optional(),  // para update_*
  reason: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  date: z.string().optional()
});

const OrchestratorInputSchema = z.object({
  interaction: z.object({
    source: z.enum(['email','voice','meeting','note']),
    subject: z.string().optional(),
    body: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    timestamp: z.string().optional()
  }),
  related_entities: z.record(z.any()).optional(),
  policy: z.record(z.any()).optional()
});

const OrchestratorOutputSchema = z.object({
  actions: z.array(ActionSchema).default([])
});

export type OrchestratorInput  = z.infer<typeof OrchestratorInputSchema>;
export type OrchestratorOutput = z.infer<typeof OrchestratorOutputSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Interaction = z.infer<typeof OrchestratorInputSchema>['interaction'];

/* ---------- Prompt (prohíbe logs y sugerencias) ---------- */

const orchestratePrompt = ai.definePrompt({
  name: 'orchestrateInteraction',
  model: googleAI.model('gemini-2.0-flash-lite'),
  input:  { schema: OrchestratorInputSchema },
  output: { schema: OrchestratorOutputSchema },
  prompt: `
You are CorchCRM's Orchestrator AI.
Return ONLY a JSON object with an "actions" array. No extra text.

Allowed actions: update_entity, create_entity, create_task, create_ai_draft, create_meeting, notify_user.
Allowed targets: companies, contacts, deals, emails, tasks, ai_drafts, meetings, notifications.
DO NOT output "log_action" or "suggest" under any circumstance.

Rules:
- Output at least ONE concrete action per interaction.
- Prefer small, atomic actions.
- Each action should include a short "reason".
- Include "confidence" (0..1) when making decisions.
- Use ISO UTC timestamps when proposing dates.
- If updating deals.stage, consider adjusting probability.

Interaction:
{{interaction}}

Related entities:
{{related_entities}}

Policy:
{{policy}}

Return JSON strictly matching the output schema.
`
});

/* ---------- Flow ---------- */

const orchestrateInteractionFlow = ai.defineFlow(
  { name: 'orchestrateInteractionFlow', inputSchema: OrchestratorInputSchema, outputSchema: OrchestratorOutputSchema },
  async (input): Promise<OrchestratorOutput> => {
    if (!input?.interaction?.source) {
      console.warn('[orchestrateInteractionFlow] Missing interaction.source');
      return { actions: [] }; // Sin logs; fase posterior se encarga
    }
    try {
      const res = await orchestratePrompt(input);
      const out = typeof (res as any)?.output === 'function'
        ? (res as any).output()
        : (res as any)?.output;

      const actions = Array.isArray(out?.actions) ? out.actions : [];
      // Filtro defensivo por si el modelo insiste en colar tipos no permitidos
      const validTypes = new Set(['update_entity','create_entity','create_task','create_ai_draft','create_meeting','notify_user']);
      const validTargets = new Set(['companies','contacts','deals','emails','tasks','ai_drafts','meetings','notifications']);

      const concrete = actions.filter(a => validTypes.has(a?.type) && validTargets.has(a?.target));
      return { actions: concrete };
    } catch (e:any) {
      console.error('[orchestrateInteractionFlow]', e?.message || e);
      return { actions: [] }; // Nada de log_action aquí
    }
  }
);

/* ---------- Helper ---------- */

export async function orchestrateInteraction(input: OrchestratorInput): Promise<OrchestratorOutput> {
  return orchestrateInteractionFlow(input);
}
