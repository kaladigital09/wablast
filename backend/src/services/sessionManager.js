import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import QRCode from 'qrcode';
import { useSupabaseAuthState } from './authState.js';
import { supabase } from '../db/supabase.js';

const logger = pino({ level: 'warn' });
const sessions = new Map();

function getSessionEntry(sessionId) {
  return (
    sessions.get(sessionId) || {
      sock: null,
      qr: null,
      status: 'disconnected',
      lastError: null,
    }
  );
}

async function updateSessionStatus(sessionId, status, extra = {}) {
  await supabase
    .from('wa_sessions')
    .update({ status, ...extra, updated_at: new Date().toISOString() })
    .eq('id', sessionId);
}

export async function startSession(sessionId) {
  const existing = sessions.get(sessionId);
  if (existing?.sock && existing.status === 'connected') {
    return existing;
  }

  const { state, saveCreds, clearAuth } = await useSupabaseAuthState(sessionId);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false,
    logger,
    browser: ['BlastWA', 'Chrome', '1.0.0'],
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  const entry = { sock, qr: null, status: 'connecting', lastError: null, clearAuth };
  sessions.set(sessionId, entry);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      entry.qr = await QRCode.toDataURL(qr);
      entry.status = 'qr';
      await updateSessionStatus(sessionId, 'qr');
    }

    if (connection === 'open') {
      entry.qr = null;
      entry.status = 'connected';
      entry.lastError = null;
      const phone = sock.user?.id?.split(':')[0]?.split('@')[0] || null;
      await updateSessionStatus(sessionId, 'connected', { phone_number: phone });
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      entry.status = loggedOut ? 'logged_out' : 'disconnected';
      entry.lastError = lastDisconnect?.error?.message || null;
      await updateSessionStatus(sessionId, entry.status);

      if (loggedOut) {
        await clearAuth();
        sessions.delete(sessionId);
      } else {
        // Auto reconnect
        setTimeout(() => startSession(sessionId).catch(() => {}), 3000);
      }
    }
  });

  return entry;
}

export function getSession(sessionId) {
  return getSessionEntry(sessionId);
}

export async function stopSession(sessionId) {
  const entry = sessions.get(sessionId);
  if (entry?.sock) {
    try {
      await entry.sock.logout();
    } catch (_) {}
    sessions.delete(sessionId);
  }
  await updateSessionStatus(sessionId, 'disconnected');
}

export async function sendMessage(sessionId, jid, content) {
  const entry = sessions.get(sessionId);
  if (!entry?.sock || entry.status !== 'connected') {
    throw new Error('Session belum terhubung');
  }
  return entry.sock.sendMessage(jid, content);
}

export function listActiveSessions() {
  return [...sessions.entries()].map(([id, e]) => ({
    id,
    status: e.status,
    hasQR: !!e.qr,
  }));
}
