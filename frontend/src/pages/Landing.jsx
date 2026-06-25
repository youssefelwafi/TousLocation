import { Link, Navigate } from "react-router-dom";
import { Package, FileText, ShoppingCart, BarChart3, ShieldCheck, Globe, ArrowRight, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth, homeFor } from "../auth";
import { applyDir } from "../i18n";

function LangButton() {
  const { i18n } = useTranslation();
  const to = i18n.language === "ar" ? "fr" : "ar";
  return (
    <button className="land-lang" onClick={() => { i18n.changeLanguage(to); localStorage.setItem("lang", to); applyDir(to); }}>
      <Languages size={15} /> {to === "ar" ? "العربية" : "Français"}
    </button>
  );
}

export default function Landing() {
  const { t } = useTranslation();
  const { user } = useAuth();
  if (user) return <Navigate to={homeFor(user)} replace />;

  const features = [
    { icon: Package, t: t("landing.f1_t"), d: t("landing.f1_d") },
    { icon: FileText, t: t("landing.f2_t"), d: t("landing.f2_d") },
    { icon: ShoppingCart, t: t("landing.f3_t"), d: t("landing.f3_d") },
    { icon: BarChart3, t: t("landing.f4_t"), d: t("landing.f4_d") },
    { icon: ShieldCheck, t: t("landing.f5_t"), d: t("landing.f5_d") },
    { icon: Globe, t: t("landing.f6_t"), d: t("landing.f6_d") },
  ];

  return (
    <div className="landing">
      <header className="land-header">
        <img src="/logo.png" alt="TousLocation" className="land-logo" />
        <div className="land-nav">
          <LangButton />
          <Link to="/connexion" className="btn-ghost">{t("landing.cta_login")}</Link>
        </div>
      </header>

      <section className="land-hero">
        <h1>{t("landing.tagline")}</h1>
        <p>{t("landing.sub")}</p>
        <div className="land-cta">
          <Link to="/boutiques" className="btn-primary big">{t("nav2.shops")} <ArrowRight size={18} /></Link>
          <Link to="/connexion" className="btn-ghost big">{t("landing.cta_login")}</Link>
        </div>
        <small className="land-loginq">{t("landing.login_q")} <Link to="/connexion">{t("landing.cta_login")}</Link></small>
      </section>

      <section className="land-features">
        <h2>{t("landing.features_title")}</h2>
        <div className="land-grid">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div className="land-card" key={i}>
                <div className="land-ic"><Icon size={22} /></div>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="land-footer">{t("landing.footer")}</footer>
    </div>
  );
}
