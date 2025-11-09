import { config } from 'dotenv';
config({ path: '.env.local' });

import '@/ai/flows/summarize-text.ts';
