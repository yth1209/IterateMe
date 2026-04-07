import axios from 'axios';
import { getAccessToken, setAccessToken, clearAccessToken } from './auth';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// 요청 인터셉터: Access Token 자동 첨부
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

// 응답 인터셉터: 401 발생 시 Refresh Token으로 Access Token 재발급
let isRefreshing = false;
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !isRefreshing) {
      original._retry = true;
      isRefreshing = true;
      try {
        const { data } = await axios.post(
          '/api/auth/refresh',
          {},
          { withCredentials: true },
        );
        setAccessToken(data.accessToken);
        original.headers.set('Authorization', `Bearer ${data.accessToken}`);
        return api(original);
      } catch (_) {
        clearAccessToken();
        window.location.href = '/login';
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

export default api;
