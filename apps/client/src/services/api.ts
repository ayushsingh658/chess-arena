import type {
  AuthResponse,
  PublicProfile,
  RegisterPayload,
  AuthCredentials,
} from '@chess-arena/shared';

// ─────────────────────────────────────────────────────────
// API Client
// ─────────────────────────────────────────────────────────
// Centralized HTTP client for REST API calls.
// Uses native fetch — no need for axios in modern browsers.
// Automatically attaches JWT token to requests.

const API_BASE = '';

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // Send cookies for refresh token
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: 'An unexpected error occurred',
      error: 'UNKNOWN',
    }));
    throw new ApiError(
      error.message || 'Request failed',
      response.status,
      error.error || 'UNKNOWN',
      error.fields
    );
  }

  return response.json() as Promise<T>;
}

export class ApiError extends Error {
  public status: number;
  public code: string;
  public fields?: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    status: number,
    code: string,
    fields?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.name = 'ApiError';
  }
}

// ── Auth API ────────────────────────────────────────────

export const authApi = {
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const data = await request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setAccessToken(data.accessToken);
    return data;
  },

  async login(payload: AuthCredentials): Promise<AuthResponse> {
    const data = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setAccessToken(data.accessToken);
    return data;
  },

  async loginAsGuest(): Promise<AuthResponse> {
    const data = await request<AuthResponse>('/auth/guest', {
      method: 'POST',
    });
    setAccessToken(data.accessToken);
    return data;
  },

  async getProfile(): Promise<{ user: PublicProfile }> {
    return request<{ user: PublicProfile }>('/auth/me');
  },

  async refreshToken(): Promise<{ accessToken: string }> {
    const data = await request<{ accessToken: string }>('/auth/refresh', {
      method: 'POST',
    });
    setAccessToken(data.accessToken);
    return data;
  },

  async logout(): Promise<void> {
    await request('/auth/logout', { method: 'POST' });
    setAccessToken(null);
  },
};

export const api = {
  get: async (endpoint: string) => request<any>(endpoint, { method: 'GET' }),
  post: async (endpoint: string, data: any) => request<any>(endpoint, { method: 'POST', body: JSON.stringify(data) }),
};
