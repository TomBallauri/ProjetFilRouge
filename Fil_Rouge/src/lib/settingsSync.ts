import type { UserSettings } from '../types/User';

// Fire-and-forget : pousse les préférences vers le compte (pas de retry, pas de blocage UI).
// Sans effet si l'utilisateur n'est pas connecté — les réglages restent alors locaux au navigateur.
export function syncSettingsToServer(patch: UserSettings) {
  const token = localStorage.getItem('token');
  if (!token) return;
  fetch('/api/users/me/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(patch),
  }).catch(() => {});
}
