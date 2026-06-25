import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

// Origine de l'API (sans /api) pour construire les URLs d'images.
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");
// URL absolue (catalogue importé) renvoyée telle quelle ; sinon préfixée par l'origine de l'API.
export const assetUrl = (path) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path}`;
};

const api = axios.create({
  baseURL: API_URL,
  headers: { Accept: "application/json" },
});

// Attach the bearer token to every request if present.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, clear the session and bounce to login.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (location.pathname !== "/connexion") location.href = "/connexion";
    }
    return Promise.reject(err);
  }
);

// Télécharge un PDF (facture / reçu) avec le token d'auth.
async function downloadPdf(endpoint, filename) {
  const res = await api.get(endpoint, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Facture PDF d'une location.
export const downloadInvoice = (rentalId) => downloadPdf(`/locations/${rentalId}/facture`, `facture-${rentalId}.pdf`);

// Reçu PDF d'une vente.
export const downloadSaleReceipt = (venteId) => downloadPdf(`/ventes/${venteId}/recu`, `recu-vente-${venteId}.pdf`);

export default api;
