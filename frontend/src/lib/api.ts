const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = { message: 'An error occurred' };
    }

    // Special handling for 401
    if (response.status === 401) {
      // We don't redirect here anymore to avoid race conditions during login
      // But we can still clear the token if it's definitely invalid
      // localStorage.removeItem('token'); 
    }

    throw new Error(errorData.message || 'Something went wrong');
  }

  if (response.status === 204) return {} as T;
  return response.json();
}
