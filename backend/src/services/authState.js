import { initAuthCreds, BufferJSON, proto } from '@whiskeysockets/baileys';
import { supabase } from '../db/supabase.js';

const TABLE = 'wa_auth_state';

async function readData(sessionId, key) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('value')
    .eq('session_id', sessionId)
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return JSON.parse(data.value, BufferJSON.reviver);
}

async function writeData(sessionId, key, value) {
  const payload = JSON.stringify(value, BufferJSON.replacer);
  const { error } = await supabase.from(TABLE).upsert(
    { session_id: sessionId, key, value: payload, updated_at: new Date().toISOString() },
    { onConflict: 'session_id,key' }
  );
  if (error) throw error;
}

async function removeData(sessionId, key) {
  await supabase.from(TABLE).delete().eq('session_id', sessionId).eq('key', key);
}

export async function useSupabaseAuthState(sessionId) {
  const creds = (await readData(sessionId, 'creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const result = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(sessionId, `${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              if (value) result[id] = value;
            })
          );
          return result;
        },
        set: async (data) => {
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              tasks.push(value ? writeData(sessionId, key, value) : removeData(sessionId, key));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: () => writeData(sessionId, 'creds', creds),
    clearAuth: async () => {
      await supabase.from(TABLE).delete().eq('session_id', sessionId);
    },
  };
}
