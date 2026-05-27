export const AUTH_STORAGE_KEY = "portfolio-tracker-auth";

export type StoredAuth = {
  username: string;
  displayName: string;
  email: string;
  twoFactorEnabled: boolean;
};

export function getStoredAuth(): StoredAuth | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function setStoredAuth(auth: StoredAuth) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  window.dispatchEvent(new Event("portfolio-auth-changed"));
}

export function clearStoredAuth() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new Event("portfolio-auth-changed"));
}

export function getActiveUsername() {
  return getStoredAuth()?.username ?? "local_user";
}