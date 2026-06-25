import { Link, NavLink, useNavigate } from "react-router-dom";
import { Store, FileText, LogOut, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth";
import { applyDir } from "../i18n";

export default function ClientLayout({ children }) {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const to = i18n.language === "ar" ? "fr" : "ar";
  const handleLogout = async () => { await logout(); navigate("/connexion"); };

  return (
    <div className="client-app">
      <header className="client-header">
        <Link to="/magasin"><img src="/logo.png" alt="TousLocation" className="land-logo" /></Link>
        <nav className="client-nav">
          <NavLink to="/magasin"><Store size={16} /> {t("store.marketplace")}</NavLink>
          <NavLink to="/mes-locations"><FileText size={16} /> {t("nav2.my_rentals")}</NavLink>
        </nav>
        <div className="client-right">
          <button className="land-lang" onClick={() => { i18n.changeLanguage(to); localStorage.setItem("lang", to); applyDir(to); }}>
            <Languages size={15} /> {to === "ar" ? "ع" : "FR"}
          </button>
          <span className="client-user">{user?.nom}</span>
          <button className="icon-btn danger" onClick={handleLogout} title={t("nav.logout")}><LogOut size={16} /></button>
        </div>
      </header>
      <main className="client-content">{children}</main>
    </div>
  );
}
