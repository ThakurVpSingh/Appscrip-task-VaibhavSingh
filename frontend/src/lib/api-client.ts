const sessionTokenKey = "studio-co-auth-token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(sessionTokenKey);
}

export function setAuthToken(token: string | null | undefined): void {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(sessionTokenKey, token);
  } else {
    localStorage.removeItem(sessionTokenKey);
  }
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(sessionTokenKey);
}

export function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init?.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, {
    ...init,
    credentials: "include",
    headers,
  });
}
