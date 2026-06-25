import { useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon, CalendarPlus, Search, Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import api, { assetUrl } from "../api";
import Loader from "../components/Loader";
import Modal from "../components/Modal";
import { toast } from "../notify";
import { formatMoney } from "../utils/format";

const TAX = 20;

// Date+heure locale au format input datetime-local (YYYY-MM-DDTHH:mm).
function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function ClientStore() {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filtres
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState(""); // recherche appliquée (debounced)
  const [shop, setShop] = useState("");

  // Commande
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ start: "", end: "", quantity: 1 });
  const [minDt, setMinDt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Boutiques pour le filtre.
  useEffect(() => {
    api.get("/boutiques").then((r) => setShops(r.data)).catch(() => setShops([]));
  }, []);

  // Recherche temporisée (debounce).
  const debRef = useRef();
  useEffect(() => {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(debRef.current);
  }, [search]);

  // Charge la 1re page à chaque changement de filtre.
  useEffect(() => {
    setLoading(true);
    api.get("/catalogue", { params: { search: query, boutique: shop || undefined, page: 1 } })
      .then((r) => { setProducts(r.data.data); setTotal(r.data.total); setPage(1); setLastPage(r.data.last_page); })
      .finally(() => setLoading(false));
  }, [query, shop]);

  function loadMore() {
    const next = page + 1;
    setLoadingMore(true);
    api.get("/catalogue", { params: { search: query, boutique: shop || undefined, page: next } })
      .then((r) => { setProducts((p) => [...p, ...r.data.data]); setPage(next); })
      .finally(() => setLoadingMore(false));
  }

  const days = useMemo(() => {
    if (!form.start || !form.end) return 0;
    const s = new Date(form.start); s.setHours(0, 0, 0, 0);
    const e = new Date(form.end); e.setHours(0, 0, 0, 0);
    const d = (e - s) / 86400000;
    return d >= 0 ? d + 1 : 0;
  }, [form]);
  const totalEstimate = sel ? Number(sel.prix_par_jour) * Number(form.quantity || 1) * days * (1 + TAX / 100) : 0;

  function openRequest(p) {
    const now = nowLocal();
    setSel(p);
    setForm({ start: now, end: now, quantity: 1 });
    setMinDt(now);
    setError("");
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await api.post("/locations", {
        date_debut: form.start, date_fin: form.end,
        items: [{ materiel_id: sel.id, quantite: Number(form.quantity) }],
      });
      setSel(null);
      toast(t("store.sent"), "success");
    } catch (err) {
      setError(err.response?.data?.message || t("common.error"));
    } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="page-head">
        <h2>{t("store.marketplace")}</h2>
        {!loading && <span className="muted">{total} {t("store.results")}</span>}
      </div>

      {/* Barre de filtres */}
      <div className="store-filters">
        <div className="search-field grow">
          <Search size={16} />
          <input placeholder={t("store.search_ph")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="search-field">
          <Store size={16} />
          <select value={shop} onChange={(e) => setShop(e.target.value)}>
            <option value="">{t("store.all_shops")}</option>
            {shops.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.products_count})</option>)}
          </select>
        </div>
      </div>

      {loading ? <Loader /> : products.length === 0 ? (
        <p className="muted" style={{ padding: 24 }}>{t("store.no_results")}</p>
      ) : (
        <>
          <div className="store-grid">
            {products.map((p) => (
              <div className="store-card" key={p.id}>
                <div className="sc-thumb">
                  {p.url_image ? <img src={assetUrl(p.url_image)} alt="" loading="lazy" /> : <ImageIcon size={28} />}
                </div>
                <div className="sc-body">
                  <span className="sc-shop"><Store size={11} /> {p.proprietaire?.nom}</span>
                  <strong>{p.nom}</strong>
                  <span className="muted">{p.marque?.nom || p.categorie?.nom}</span>
                  <span className="sc-price">{formatMoney(p.prix_par_jour, p.devise?.symbole || "DH")}{t("store.per")}{p.unite?.symbole || "j"}</span>
                </div>
                <button className="btn-primary" onClick={() => openRequest(p)}><CalendarPlus size={15} /> {t("store.rent")}</button>
              </div>
            ))}
          </div>
          {page < lastPage && (
            <div style={{ textAlign: "center", marginTop: 22 }}>
              <button className="btn-ghost" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? t("common.loading") : t("store.load_more")}
              </button>
            </div>
          )}
        </>
      )}

      {sel && (
        <Modal title={`${t("store.request_title")} — ${sel.nom}`} onClose={() => setSel(null)}>
          <form className="form" onSubmit={submit}>
            {error && <div className="alert">{error}</div>}
            <p className="muted" style={{ marginTop: 0 }}><Store size={12} /> {sel.proprietaire?.nom}</p>
            <div className="form-row">
              <div>
                <label>{t("store.start")}</label>
                <input type="datetime-local" value={form.start} min={minDt}
                  onChange={(e) => setForm({ ...form, start: e.target.value })} required />
              </div>
              <div>
                <label>{t("store.end")}</label>
                <input type="datetime-local" value={form.end} min={form.start || minDt}
                  onChange={(e) => setForm({ ...form, end: e.target.value })} required />
              </div>
            </div>
            <label>{t("store.qty")}</label>
            <input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
            <div className="pay-summary" style={{ marginTop: 12 }}>
              <div className="ttc"><span>{t("store.estimate")}</span><strong>{formatMoney(totalEstimate)}</strong></div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={() => setSel(null)}>{t("common.cancel")}</button>
              <button type="submit" className="btn-primary" disabled={saving || days <= 0}>{saving ? t("common.saving") : t("store.submit")}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
