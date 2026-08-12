export class ApiError extends Error {}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    credentials: 'include',     // <-- ADD THIS so cookies (connect.sid) are sent
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const adminToken = {
  get: () => localStorage.getItem('footi-admin-token') ?? '',
  set: (t: string) => localStorage.setItem('footi-admin-token', t),
};

export type { Me } from './types';