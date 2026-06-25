import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../api";
import { toast, confirmDialog } from "../notify";
import Modal from "../components/Modal";
import Loader from "../components/Loader";
import { formatDate, formatMoney } from "../utils/format";

const CATEGORIES = ["Loyer", "Salaires", "Électricité", "Eau", "Carburant", "Maintenance", "Transport", "Marketing", "Autre"];
const EMPTY = { categorie: "Loyer", libelle: "", montant: "", date_depense: "", fournisseur_id: "", type_paiement_id: "", reference: "", note: "" };

export default function Expenses() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api.get("/depenses", { params: { search } }).then((r) => setRows(r.data.data || r.data)).finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    api.get("/fournisseurs").then((r) => setSuppliers(r.data));
    api.get("/types-paiement").then((r) => setPaymentTypes(r.data));
    // eslint-disable-next-line
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  function openCreate() { setEditing(null); setForm({ ...EMPTY, date_depense: new Date().toISOString().slice(0, 10) }); setErrors({}); setOpen(true); }
  function openEdit(r) {
    setEditing(r);
    setForm({ categorie: r.categorie, libelle: r.libelle, montant: r.montant, date_depense: r.date_depense?.slice(0, 10),
      fournisseur_id: r.fournisseur_id || "", type_paiement_id: r.type_paiement_id || "", reference: r.reference || "", note: r.note || "" });
    setErrors({}); setOpen(true);
  }

  async function save(e) {
    e.preventDefault(); setSaving(true); setErrors({});
    const payload = { ...form, fournisseur_id: form.fournisseur_id || null, type_paiement_id: form.type_paiement_id || null };
    try {
      if (editing) await api.put(`/depenses/${editing.id}`, payload);
      else await api.post("/depenses", payload);
      setOpen(false); load();
    } catch (err) {
      if (err.response?.status === 422) setErrors(err.response.data.errors || {});
      else toast(err.response?.data?.message || t("common.error"));
    } finally { setSaving(false); }
  }
  async function remove(r) {
    if (!await confirmDialog(t("common.confirm_delete", { name: r.libelle }))) return;
    try { await api.delete(`/depenses/${r.id}`); load(); }
    catch (err) { toast(err.response?.data?.message || t("common.error")); }
  }

  const total = rows.reduce((s, r) => s + Number(r.montant || 0), 0);

  return (
    <div>
      <div className="page-head">
        <h2>{t("expenses.title")}</h2>
        <button className="btn-primary" onClick={openCreate}><Plus size={16} /> {t("expenses.new")}</button>
      </div>
      <div className="toolbar">
        <div className="search-field">
          <Search size={16} />
          <input placeholder={t("common.search_ph")} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        </div>
        <button onClick={load}>{t("common.search")}</button>
        <span style={{ marginInlineStart: "auto", alignSelf: "center", fontWeight: 600 }}>{t("rentals.estimated") ? "" : ""}{formatMoney(total)}</span>
      </div>
      {loading ? <Loader /> : (
        <table className="table">
          <thead><tr>
            <th>{t("expenses.date")}</th><th>{t("expenses.category")}</th><th>{t("expenses.label")}</th>
            <th>{t("expenses.supplier")}</th><th>{t("expenses.payment_type")}</th><th>{t("expenses.amount")}</th>
            <th className="actions-col">{t("common.actions")}</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatDate(r.date_depense)}</td>
                <td><span className="badge badge-pending">{r.categorie}</span></td>
                <td>{r.libelle}</td>
                <td className="muted">{r.fournisseur?.nom || "-"}</td>
                <td className="muted">{r.type_paiement?.nom || "-"}</td>
                <td>{formatMoney(r.montant)}</td>
                <td className="actions-col">
                  <button className="icon-btn" title={t("common.edit")} onClick={() => openEdit(r)}><Pencil size={16} /></button>
                  <button className="icon-btn danger" title={t("common.delete")} onClick={() => remove(r)}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="7" className="empty">{t("expenses.none")}</td></tr>}
          </tbody>
        </table>
      )}
      {open && (
        <Modal title={editing ? t("expenses.edit") : t("expenses.new")} onClose={() => setOpen(false)}>
          <form className="form" onSubmit={save}>
            <div className="form-row">
              <div>
                <label>{t("expenses.category")}</label>
                <select value={form.categorie} onChange={set("categorie")}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label>{t("expenses.date")}</label>
                <input type="date" value={form.date_depense} onChange={set("date_depense")} required />
              </div>
            </div>
            <label>{t("expenses.label")}</label>
            <input value={form.libelle} onChange={set("libelle")} required />
            {errors.libelle && <small className="err">{errors.libelle[0]}</small>}
            <div className="form-row">
              <div>
                <label>{t("expenses.amount")}</label>
                <input type="number" min="0" step="0.01" value={form.montant} onChange={set("montant")} required />
                {errors.montant && <small className="err">{errors.montant[0]}</small>}
              </div>
              <div>
                <label>{t("expenses.payment_type")}</label>
                <select value={form.type_paiement_id} onChange={set("type_paiement_id")}>
                  <option value="">{t("expenses.choose")}</option>
                  {paymentTypes.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div>
                <label>{t("expenses.supplier")}</label>
                <select value={form.fournisseur_id} onChange={set("fournisseur_id")}>
                  <option value="">{t("expenses.choose")}</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </div>
              <div>
                <label>{t("expenses.reference")}</label>
                <input value={form.reference} onChange={set("reference")} />
              </div>
            </div>
            <label>{t("rentals.note")}</label>
            <input value={form.note} onChange={set("note")} />
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
