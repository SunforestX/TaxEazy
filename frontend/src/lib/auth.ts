import api from './api';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'accountant';
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export const auth = {
  async login(credentials: LoginCredentials): Promise<AuthTokens> {
    const response = await api.post('/auth/login', credentials);
    const tokens = response.data;
    
    // Store tokens
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
    
    return tokens;
  },

  async logout(): Promise<void> {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  async getCurrentUser(): Promise<User> {
    const response = await api.get('/auth/me');
    return response.data;
  },

  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('access_token');
    }
    return null;
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },
};

export default auth;
