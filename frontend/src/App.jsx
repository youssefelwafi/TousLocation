import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, FileText, Users as UsersIcon, ShieldCheck, Truck, ShoppingCart, ShoppingBag, Receipt, SlidersHorizontal, BarChart3, Settings as SettingsIcon, UserCog, LogOut, Languages, Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AuthProvider, useAuth, isStaff, isSuperAdmin, isClient, isManager, hasModule, homeFor } from "./auth";
import { applyDir } from "./i18n";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Shops from "./pages/Shops";
import Shop from "./pages/Shop";
import RegisterClient from "./pages/RegisterClient";
import ClientStore from "./pages/ClientStore";
import ClientRentals from "./pages/ClientRentals";
import ClientLayout from "./components/ClientLayout";
import Dashboard from "./pages/Dashboard";
import Equipments from "./pages/Equipments";
import Rentals from "./pages/Rentals";
import Clients from "./pages/Clients";
import Suppliers from "./pages/Suppliers";
import Purchases from "./pages/Purchases";
import Sales from "./pages/Sales";
import Expenses from "./pages/Expenses";
import Adjustments from "./pages/Adjustments";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Employees from "./pages/Employees";
import Users from "./pages/Users";
import Notifications from "./components/Notifications";
import "./App.css";

// Route protégée : exige connexion + (option) un rôle/module.
function Protected({ children, need }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/connexion" replace />;
  if (need === "staff" && !isStaff(user)) return <Navigate to={homeFor(user)} replace />;
  if (need === "client" && !isClient(user)) return <Navigate to={homeFor(user)} replace />;
  if (need === "manager" && !(isManager(user) || isSuperAdmin(user))) return <Navigate to={homeFor(user)} replace />;
  if (need === "super" && !isSuperAdmin(user)) return <Navigate to={homeFor(user)} replace />;
  return children;
}

function LanguageToggle() {
  const { i18n } = useTranslation();
  const switchTo = i18n.language === "ar" ? "fr" : "ar";
  const change = () => { i18n.changeLanguage(switchTo); localStorage.setItem("lang", switchTo); applyDir(switchTo); };
  return (
    <button className="lang-toggle" onClick={change} title="Langue / اللغة">
      <Languages size={16} /> {switchTo === "ar" ? "العربية" : "Français"}
    </button>
  );
}

const NAV = [
  { to: "/tableau-de-bord", icon: LayoutDashboard, key: "nav.dashboard", mod: null },
  { to: "/materiels", icon: Package, key: "nav.materials", mod: "materiels" },
  { to: "/locations", icon: FileText, key: "nav.rentals", mod: "locations" },
  { to: "/clients", icon: UsersIcon, key: "nav.clients", mod: "clients" },
  { to: "/fournisseurs", icon: Truck, key: "nav.suppliers", mod: "fournisseurs" },
  { to: "/achats", icon: ShoppingCart, key: "nav.purchases", mod: "achats" },
  { to: "/ventes", icon: ShoppingBag, key: "nav.sales", mod: "ventes" },
  { to: "/depenses", icon: Receipt, key: "nav.expenses", mod: "depenses" },
  { to: "/ajustements", icon: SlidersHorizontal, key: "nav.adjustments", mod: "ajustements" },
  { to: "/rapports", icon: BarChart3, key: "nav.reports", mod: "rapports" },
  { to: "/parametres", icon: SettingsIcon, key: "nav.settings", mod: "parametres" },
];

function Layout({ children }) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const handleLogout = async () => { await logout(); navigate("/connexion"); };
  const closeMenu = () => setMenuOpen(false);
  return (
    <div className="app">
      <header className="topbar">
        <button className="hamburger" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <img src="/logo.png" alt="TousLocation" className="topbar-logo" />
      </header>
      {menuOpen && <div className="sidebar-overlay" onClick={closeMenu} />}
      <aside className={`sidebar${menuOpen ? " open" : ""}`}>
        <div className="brand"><img src="/logo.png" alt="TousLocation" /></div>
        <nav onClick={closeMenu}>
          {NAV.filter((n) => n.mod === null || hasModule(user, n.mod)).map((n) => {
            const Icon = n.icon;
            return <Link key={n.to} to={n.to}><Icon size={18} /> {t(n.key)}</Link>;
          })}
          {(isManager(user) || isSuperAdmin(user)) && (
            <Link to="/employes"><UserCog size={18} /> {t("nav2.employees")}</Link>
          )}
          {isSuperAdmin(user) && (
            <Link to="/utilisateurs"><ShieldCheck size={18} /> {t("nav.users")}</Link>
          )}
        </nav>
        <div className="user-box">
          <LanguageToggle />
          <span>{user?.nom}</span>
          <small>{user?.role}</small>
          <button onClick={handleLogout}><LogOut size={16} /> {t("nav.logout")}</button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

const staffPage = (el) => <Protected need="staff"><Layout>{el}</Layout></Protected>;
const clientPage = (el) => <Protected need="client"><ClientLayout>{el}</ClientLayout></Protected>;

export default function App() {
  return (
    <AuthProvider>
      <Notifications />
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/connexion" element={<Login />} />
          <Route path="/boutiques" element={<Shops />} />
          <Route path="/boutique/:id" element={<Shop />} />
          <Route path="/inscription-client" element={<RegisterClient />} />

          {/* Client */}
          <Route path="/magasin" element={clientPage(<ClientStore />)} />
          <Route path="/mes-locations" element={clientPage(<ClientRentals />)} />

          {/* Staff */}
          <Route path="/tableau-de-bord" element={staffPage(<Dashboard />)} />
          <Route path="/materiels" element={staffPage(<Equipments />)} />
          <Route path="/locations" element={staffPage(<Rentals />)} />
          <Route path="/clients" element={staffPage(<Clients />)} />
          <Route path="/fournisseurs" element={staffPage(<Suppliers />)} />
          <Route path="/achats" element={staffPage(<Purchases />)} />
          <Route path="/ventes" element={staffPage(<Sales />)} />
          <Route path="/depenses" element={staffPage(<Expenses />)} />
          <Route path="/ajustements" element={staffPage(<Adjustments />)} />
          <Route path="/rapports" element={staffPage(<Reports />)} />
          <Route path="/parametres" element={staffPage(<Settings />)} />
          <Route path="/employes" element={<Protected need="manager"><Layout><Employees /></Layout></Protected>} />
          <Route path="/utilisateurs" element={<Protected need="super"><Layout><Users /></Layout></Protected>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
