
'use server';

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';
import { 
    ActionSchema,
    OrchestratorInputSchema, 
    OrchestratorOutputSchema,
    type OrchestratorInput,
    type OrchestratorOutput,
    type Action,
    type Interaction
} from './orchestrator-schemas';


/* ---------- Prompt con few-shots y regla "≥1 acción" ---------- */

const orchestratePrompt = ai.definePrompt({
  name: 'orchestrateInteraction',
  model: googleAI.model('gemini-1.5-flash-latest'),
  input:  { schema: OrchestratorInputSchema },
  output: { schema: OrchestratorOutputSchema },
  prompt: `
You are CorchCRM's Orchestrator AI.
Return ONLY a JSON object with an "actions" array. No extra text.

Allowed actions: create_task, update_entity, create_meeting.
Allowed targets: companies, contacts, deals, emails, tasks, meetings.

Business rules (MANDATORY):
- Always produce AT LEAST ONE action.
- If interaction.direction == "inbound" and the user is being asked for something, suggest a follow-up task.
- If interaction.direction == "outbound": MUST add create_task (reason: "Schedule follow-up for outbound email") dated 5 days from interaction.timestamp (or now).
- If email mentions demo/call/meeting with date/time, add create_meeting.
- If body implies data change (stage/amount/contact info), add update_entity with minimal "changes".

Hints:
- create_task.data:    { "deal_id": dealIdIfAny, "title": "<concise>", "due_date": "<ISO>", "owner_email": "<owner if available>" }
- create_meeting.data: { "deal_id": dealIdIfAny, "title": "Meeting/Demo", "proposed_time": "<ISO>", "participants": ["from","to"] }

Few-shots:

[Example 1 - inbound reply]
Interaction:
{"source":"email","direction":"inbound","subject":"Re: Quote","body":"Thanks! We'll sign next week.","from":"cfo@acme.com","to":"owner@corchcrm.com"}
Related:
{"deal":{"id":"deal_1","stage":"proposal","probability":0.6,"owner_email":"owner@corchcrm.com"}}
Output:
{"actions":[
  {"type":"update_entity","target":"deals","id":"deal_1","changes":{"stage":"negotiation","probability":0.8},"reason":"Move to negotiation based on signing intent","confidence":0.85}
]}

[Example 2 - outbound follow-up in 5 days]
Interaction:
{"source":"email","direction":"outbound","subject":"Proposal sent","body":"Sharing proposal for your review.","from":"owner@corchcrm.com","to":"vp@client.com","timestamp":"2025-11-08T10:00:00Z"}
Related:
{"deal":{"id":"deal_9","stage":"proposal","owner_email":"owner@corchcrm.com"}}
Output:
{"actions":[
  {"type":"create_task","target":"tasks","data":{"deal_id":"deal_9","title":"Follow up on outbound email","due_date":"2025-11-13T10:00:00Z","owner_email":"owner@corchcrm.com"},"reason":"Schedule follow-up for outbound email","confidence":0.88}
]}

[Example 3 - meeting request]
Interaction:
{"source":"email","direction":"inbound","subject":"Schedule demo","body":"Can we do Thursday 3pm CET?","from":"vp@client.com","to":"owner@corchcrm.com","timestamp":"2025-11-10T09:00:00Z"}
Related:
{"deal":{"id":"deal_7","stage":"prospect","owner_email":"owner@corchcrm.com"}}
Output:
{"actions":[
  {"type":"create_meeting","target":"meetings","data":{"deal_id":"deal_7","title":"Product demo","proposed_time":"2025-11-13T15:00:00Z","participants":["vp@client.com","owner@corchcrm.com"]},"reason":"Schedule meeting as requested in email","confidence":0.84}
]}

Now generate actions for the actual input.

Interaction:
{{interaction}}

Related:
{{related_entities}}

Policy:
{{policy}}

Return JSON strictly matching the output schema.
`
});


/* ---------- Flow con fallback (nunca vacío) ---------- */

const orchestrateInteractionFlow = ai.defineFlow(
  { name: 'orchestrateInteractionFlow', inputSchema: OrchestratorInputSchema, outputSchema: OrchestratorOutputSchema },
  async (input): Promise<OrchestratorOutput> => {
    if (!input?.interaction?.source) {
      console.warn('[orchestrateInteractionFlow] Missing interaction.source');
      return { actions: [] };
    }
    try {
      const res = await orchestratePrompt(input);
      const out = res.output;

      const actions = Array.isArray(out?.actions) ? out.actions : [];

      // Filtro defensivo
      const validTypes = new Set(['update_entity','create_meeting','create_task']);
      const validTargets = new Set(['companies','contacts','deals','emails','tasks','meetings']);
      const concrete = actions.filter(a => a && validTypes.has(a?.type) && validTargets.has(a?.target));

      if (concrete.length > 0) return { actions: concrete };

      // --------- Fallback determinista según direction ---------
      const dir   = input.interaction.direction || 'inbound';
      const subj  = (input.interaction.subject || '').trim();
      const body  = (input.interaction.body || '').trim();
      const title = (subj || body.slice(0, 60) || 'Follow up').replace(/\s+/g, ' ').trim();
      const dealId = input.related_entities?.deal?.id;
      const owner  = input.related_entities?.deal?.owner_email
                  || input.related_entities?.contact?.owner_email
                  || input.interaction.to
                  || undefined;

      const base = input.interaction.timestamp ? new Date(input.interaction.timestamp) : new Date();
      const plusDays = (n:number) => new Date(base.getTime() + n*24*3600*1000).toISOString();

      
      return {
        actions: [{
          type: 'create_task',
          target: 'tasks',
          data: {
            deal_id: dealId,
            title: `Follow up on: ${title}`,
            due_date: plusDays(dir === 'inbound' ? 2 : 5),
            owner_email: owner
          },
          reason: 'Default follow-up task',
          confidence: 0.6
        } as Action]
      };
      
    } catch (e:any) {
      console.error('[orchestrateInteractionFlow]', e?.message || e);
      // Fallback mínimo en error grave: generar una tarea de seguimiento
      const base = new Date();
      const plus5Days = new Date(base.getTime() + 5 * 24 * 3600 * 1000).toISOString();
      
      const to = input.interaction.direction === 'inbound' ? input.interaction.from : input.interaction.to;
      const subject = input.interaction.subject?.startsWith('Re: ') ? input.interaction.subject : `Re: ${input.interaction.subject}`;

      return {
        actions: [{
          type: 'create_task',
          target: 'tasks',
          data: {
            title: `Manual follow-up required for email: ${subject}`,
            to: to || 'contact@example.com',
            date: plus5Days
          },
          reason: 'Fallback: Create follow-up task due to processing error.',
          confidence: 0.5
        } as Action]
      };
    }
  }
);


/* ---------- Helper ---------- */

export async function orchestrateInteraction(input: OrchestratorInput): Promise<OrchestratorOutput> {
  return orchestrateInteractionFlow(input);
}
