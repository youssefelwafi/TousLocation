import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api";
import { useAuth } from "../auth";
import PublicTopbar from "../components/PublicTopbar";

export default function RegisterClient() {
  const { registerClient } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const shopId = params.get("shop");
  const [shopName, setShopName] = useState("");
  const [form, setForm] = useState({ nom: "", email: "", telephone: "", password: "", password_confirmation: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (shopId) api.get(`/boutiques/${shopId}`).then((r) => setShopName(r.data.shop.name)).catch(() => {});
  }, [shopId]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError(""); setErrors({}); setLoading(true);
    try {
      await registerClient({ ...form, manager_id: shopId });
      navigate("/magasin");
    } catch (err) {
      if (err.response?.status === 422) setErrors(err.response.data.errors || {});
      else setError(err.response?.data?.message || t("common.error"));
    } finally { setLoading(false); }
  }

  return (
    <div className="auth-shell">
      <PublicTopbar />
      <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <Link to={shopId ? `/boutique/${shopId}` : "/boutiques"}><img src="/logo.png" alt="TousLocation" className="brand-logo" /></Link>
        <p className="subtitle">{shopName ? t("reg_client.subtitle", { shop: shopName }) : t("reg_client.title")}</p>
        {!shopId && <div className="alert">{t("shops.subtitle")} — <Link to="/boutiques">{t("nav2.shops")}</Link></div>}
        {error && <div className="alert">{error}</div>}

        <label>{t("reg_client.name")}</label>
        <input value={form.nom} onChange={set("nom")} required />
        {errors.nom && <small className="err">{errors.nom[0]}</small>}
        <label>{t("reg_client.email")}</label>
        <input type="email" value={form.email} onChange={set("email")} required />
        {errors.email && <small className="err">{errors.email[0]}</small>}
        <label>{t("reg_client.phone")}</label>
        <input value={form.telephone} onChange={set("telephone")} dir="ltr" />
        <label>{t("reg_client.password")}</label>
        <input type="password" value={form.password} onChange={set("password")} required minLength={6} />
        {errors.password && <small className="err">{errors.password[0]}</small>}
        <label>{t("reg_client.password_confirm")}</label>
        <input type="password" value={form.password_confirmation} onChange={set("password_confirmation")} required />

        <button disabled={loading || !shopId} type="submit">{loading ? t("register.submitting") : t("reg_client.submit")}</button>
        <small className="hint">{t("reg_client.have")} <Link to="/connexion">{t("reg_client.login")}</Link></small>
      </form>
      </div>
    </div>
  );
}
