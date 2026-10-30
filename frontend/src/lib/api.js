import axios from 'axios';

// One shared Axios instance for every backend call.
// - baseURL "/api": in development Vite proxies it to the Express server.
// - withCredentials: send the httpOnly auth cookie with each request.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
  timeout: 15000,
});

// Turn any Axios error into a readable message for the UI.
export function getErrorMessage(error) {
  return error?.response?.data?.message || error?.message || 'Something went wrong';
}

// Field-level validation messages from the backend, e.g. [{ field: 'email', message: '...' }].
export function getFieldErrors(error) {
  return error?.response?.data?.errors ?? [];
}
