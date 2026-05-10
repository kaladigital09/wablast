import { supabase } from '../db/supabase.js';
import crypto from 'crypto';

/**
 * Generate password random yang aman & mudah dibaca.
 * 12 karakter alfanumerik (tanpa karakter ambigu seperti 0/O, 1/l/I).
 */
export function generatePassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Buat user baru di Supabase Auth + profile.
 * Returns { user, password } — password hanya di-return sekali.
 */
export async function createClientUser({ email, fullName, clientId }) {
  const password = generatePassword();

  // Buat user di Supabase Auth (via admin API)
  const { data: userData, error: userErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // auto-confirm tanpa email verification
    user_metadata: { full_name: fullName },
  });
  if (userErr) throw new Error(`Create user gagal: ${userErr.message}`);

  // Buat profile dengan role client_user
  const { error: profileErr } = await supabase.from('user_profiles').insert({
    id: userData.user.id,
    role: 'client_user',
    client_id: clientId,
    full_name: fullName,
  });
  if (profileErr) {
    // Rollback: delete auth user kalau profile gagal
    await supabase.auth.admin.deleteUser(userData.user.id);
    throw new Error(`Create profile gagal: ${profileErr.message}`);
  }

  // Set owner_user_id di clients
  await supabase
    .from('clients')
    .update({ owner_user_id: userData.user.id, contact_email: email })
    .eq('id', clientId);

  return { user: userData.user, password };
}

/**
 * Buat user super admin (dipakai sekali untuk seed pertama).
 */
export async function createSuperAdmin({ email, password, fullName = 'Super Admin' }) {
  const { data: existing } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('role', 'super_admin')
    .limit(1)
    .maybeSingle();
  if (existing) {
    throw new Error('Super admin sudah ada. Tidak bisa buat ulang.');
  }

  const { data: userData, error: userErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (userErr) throw new Error(userErr.message);

  const { error: profileErr } = await supabase.from('user_profiles').insert({
    id: userData.user.id,
    role: 'super_admin',
    client_id: null,
    full_name: fullName,
  });
  if (profileErr) {
    await supabase.auth.admin.deleteUser(userData.user.id);
    throw new Error(profileErr.message);
  }

  return userData.user;
}

// In-memory cache untuk verified tokens.
// Hindari hit Supabase 3x setiap request (auth.getUser + user_profiles + clients).
// TTL 60 detik — cukup untuk burst request normal, tapi pendek supaya logout/role-change cepat ter-reflect.
const tokenCache = new Map(); // token → { user, expiresAt }
const TOKEN_CACHE_TTL_MS = 60 * 1000;
const TOKEN_CACHE_MAX = 500;

function pruneTokenCache() {
  if (tokenCache.size < TOKEN_CACHE_MAX) return;
  const now = Date.now();
  for (const [k, v] of tokenCache) {
    if (v.expiresAt < now) tokenCache.delete(k);
  }
  // Kalau masih over-limit, hapus paling lama (insertion order)
  while (tokenCache.size >= TOKEN_CACHE_MAX) {
    const firstKey = tokenCache.keys().next().value;
    tokenCache.delete(firstKey);
  }
}

export function invalidateTokenCache(token) {
  if (token) tokenCache.delete(token);
}

/**
 * Verify access token dari client → return user + profile.
 * Hasil di-cache 60 detik untuk hindari Supabase round-trip per request.
 */
export async function verifyToken(accessToken) {
  if (!accessToken) return null;

  const cached = tokenCache.get(accessToken);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }

  const { data: userData, error } = await supabase.auth.getUser(accessToken);
  if (error || !userData?.user) return null;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (!profile) return null;

  // Fetch client data terpisah (lebih reliable daripada nested select)
  let client = null;
  if (profile.client_id) {
    const { data: clientData } = await supabase
      .from('clients')
      .select('id, name, schedule_enabled')
      .eq('id', profile.client_id)
      .maybeSingle();
    client = clientData || null;
  }

  const user = {
    id: userData.user.id,
    email: userData.user.email,
    role: profile.role,
    client_id: profile.client_id,
    full_name: profile.full_name,
    client,
  };

  pruneTokenCache();
  tokenCache.set(accessToken, { user, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
  return user;
}

/**
 * Update email user (auth.users).
 */
export async function updateUserEmail(userId, newEmail) {
  if (!userId || !newEmail) return;
  const { error } = await supabase.auth.admin.updateUserById(userId, { email: newEmail });
  if (error) throw new Error(error.message);
}

/**
 * Update full_name user_profile.
 */
export async function updateUserProfile(userId, updates) {
  if (!userId) return;
  const { error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

/**
 * Reset password client user — return password baru.
 */
export async function resetClientPassword(userId) {
  const password = generatePassword();
  const { error } = await supabase.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(error.message);
  return password;
}

/**
 * Delete user (saat client dihapus).
 */
export async function deleteUser(userId) {
  if (!userId) return;
  await supabase.auth.admin.deleteUser(userId).catch(() => {});
}
