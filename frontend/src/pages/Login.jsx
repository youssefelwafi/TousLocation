import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth, homeFor } from "../auth";

export default function Login() {
  const { login } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@touslocations.com");
  const [password, setPassword] = useState("1234567890");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await login(email, password);
      navigate(homeFor(u));
    } catch (err) {
      setError(err.response?.data?.message || t("login.invalid"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <Link to="/"><img src="/logo.png" alt="TousLocation" className="brand-logo" /></Link>
        <p className="subtitle">{t("login.subtitle")}</p>
        {error && <div className="alert">{error}</div>}
        <label>{t("common.email")}</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        <label>{t("common.password")}</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        <button disabled={loading} type="submit">
          {loading ? t("login.signing") : t("login.signin")}
        </button>
        <small className="hint">{t("login.no_account")} <Link to="/boutiques">{t("nav2.shops")}</Link></small>
        <small className="hint">{t("login.demo")}</small>
      </form>
    </div>
  );
}
