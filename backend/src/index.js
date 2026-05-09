import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import sessionsRouter from './routes/sessions.js';
import clientsRouter from './routes/clients.js';
import campaignsRouter from './routes/campaigns.js';
import { startScheduler } from './services/scheduler.js';
import { supabase } from './db/supabase.js';
import { startSession } from './services/sessionManager.js';
import { authMiddleware } from './middleware/auth.js';

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL?.split(',') || '*',
  })
);
app.use(express.json({ limit: '10mb' }));

// Public endpoints
app.get('/', (_, res) => res.json({ name: 'Kala Blast Backend', status: 'ok' }));
app.get('/health', (_, res) => res.json({ ok: true, ts: Date.now() }));

// Auth routes (no middleware needed — login itself)
app.use('/api/auth', authRouter);

// Protected routes
app.use('/api', authMiddleware);
app.use('/api/clients', clientsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/campaigns', campaignsRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`[Backend] listening on :${PORT}`);
  startScheduler();

  try {
    const { data } = await supabase
      .from('wa_sessions')
      .select('id')
      .in('status', ['connected', 'connecting']);
    for (const s of data || []) {
      startSession(s.id).catch((e) => console.error('Restore session error:', e));
    }
  } catch (e) {
    console.error('Failed to restore sessions:', e.message);
  }
});
