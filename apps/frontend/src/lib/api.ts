import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1",
  withCredentials: true,
});
let csrfToken: string | null = null;

api.interceptors.request.use(async (config) => {
  if (config.method !== "get" && !csrfToken) {
    const res = await axios.get(
      `${config.baseURL}/csrf-token`,
      { withCredentials: true }
    );
    csrfToken = res.data.csrfToken;
  }
  if (csrfToken && config.method !== "get") {
    config.headers["x-csrf-token"] = csrfToken;
  }
  return config;
});

api.interceptors.request.use((config) => {
  const activeOrgId = localStorage.getItem("activeOrgId");
  if (activeOrgId) {
    config.headers["X-Organization-Id"] = activeOrgId;
  }
  return config;
});

let isRefreshing = false;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // If there's no response (network error), don't retry
    if (!error.response) {
      return Promise.reject(error);
    }

    // Don't try to refresh auth endpoints themselves
    if (
      original?.url?.includes("/auth/refresh") ||
      original?.url?.includes("/auth/login") ||
      original?.url?.includes("/auth/logout")
    ) {
      return Promise.reject(error);
    }

    if (
      error.response.status === 401 &&
      !original._retry &&
      !isRefreshing
    ) {
      original._retry = true;
      isRefreshing = true;

      try {
        await api.post("/auth/refresh");

        isRefreshing = false;

        return api(original);
      } catch (err) {
        isRefreshing = false;

        // Redirect only once
        if (window.location.pathname !== "/login") {
          window.location.replace("/login");
        }

        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);