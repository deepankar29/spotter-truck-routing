import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api",
  timeout: 90000,
});

export async function planTrip(payload) {
  const { data } = await api.post("/plan/", payload);
  return data;
}
export async function getHealth() {
  const { data } = await api.get("/health/");
  return data;
}
