import { useEffect, useState } from "react";
import { Wallet, Plus, Trash2, FileDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../api";
import { toast, confirmDialog } from "../notify";
import { useAuth, isStaff as checkStaff } from "../auth";
import Modal from "../components/Modal";
import Loader from "../components/Loader";
import RentalForm from "../components/RentalForm";
import { downloadInvoice } from "../api";
import { formatDate, formatMoney } from "../utils/format";

export default function Rentals() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isStaff = checkStaff(user);

  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);

  const [payOpen, setPayOpen] = useState(false);
  const [current, setCurrent] = useState(null); // rental whose payments are shown
  const [payments, setPayments] = useState([]);
  const [payForm, setPayForm] = useState({ montant: "", method: "cash", note: "" });
  const [payError, setPayError] = useState("");
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentTypes, setPaymentTypes] = useState([]);

  function load() {
    setLoading(true);
    api.get("/locations")
      .then((res) => setRentals(res.data.data || res.data))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    api.get("/types-paiement").then((res) => setPaymentTypes(res.data));
  }, []);

  function openPayments(rental) {
    setCurrent(rental);
    setPayForm({ montant: "", type_paiement_id: paymentTypes[0]?.id || "", note: "" });
    setPayError("");
    setPayOpen(true);
    api.get(`/locations/${rental.id}/paiements`).then((res) => setPayments(res.data));
  }

  async function addPayment(e) {
    e.preventDefault();
    setSaving(true);
    setPayError("");
    try {
      const { data } = await api.post(`/locations/${current.id}/paiements`, payForm);
      setPayments((p) => [data.payment, ...p]);
      setCurrent(data.rental);          // updated paid/remaining/status
      setRentals((rs) => rs.map((r) => (r.id === data.rental.id ? data.rental : r)));
      setPayForm({ montant: "", type_paiement_id: paymentTypes[0]?.id || "", note: "" });
    } catch (err) {
      setPayError(err.response?.data?.message || t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  async function removePayment(p) {
    if (!await confirmDialog(t("common.confirm_delete", { name: formatMoney(p.montant) }))) return;
    await api.delete(`/paiements/${p.id}`);
    setPayments((list) => list.filter((x) => x.id !== p.id));
    // refresh the rental totals
    const { data } = await api.get(`/locations/${current.id}`);
    setCurrent(data);
    setRentals((rs) => rs.map((r) => (r.id === data.id ? data : r)));
  }

  if (loading) return <Loader />;

  return (
    <div>
      <div className="page-head">
        <h2>{t("rentals.title")}</h2>
        {isStaff && (
          <button className="btn-primary" onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> {t("rentals.new")}
          </button>
        )}
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>{t("rentals.client")}</th>
            <th>{t("rentals.start")}</th>
            <th>{t("rentals.end")}</th>
            <th>{t("rentals.ttc")}</th>
            <th>{t("rentals.paid")}</th>
            <th>{t("rentals.remaining")}</th>
            <th>{t("rentals.payment")}</th>
            <th>{t("common.status")}</th>
            {isStaff && <th className="actions-col">{t("common.actions")}</th>}
          </tr>
        </thead>
        <tbody>
          {rentals.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.utilisateur?.nom || "-"}</td>
              <td>{formatDate(r.date_debut)}</td>
              <td>{formatDate(r.date_fin)}</td>
              <td>{formatMoney(r.montant_total)}</td>
              <td>{formatMoney(r.montant_paye)}</td>
              <td>{formatMoney(r.montant_restant)}</td>
              <td><span className={`badge badge-pay-${r.statut_paiement}`}>{t(`status.${r.statut_paiement}`)}</span></td>
              <td><span className={`badge badge-${r.statut}`}>{t(`status.${r.statut}`)}</span></td>
              {isStaff && (
                <td className="actions-col">
                  <button className="icon-btn" title={t("rentals.payments")} onClick={() => openPayments(r)}>
                    <Wallet size={16} />
                  </button>
                  <button className="icon-btn" title={t("rentals.invoice")} onClick={() => downloadInvoice(r.id)}>
                    <FileDown size={16} />
                  </button>
                </td>
              )}
            </tr>
          ))}
          {rentals.length === 0 && (
            <tr><td colSpan={isStaff ? 10 : 9} className="empty">{t("rentals.none")}</td></tr>
          )}
        </tbody>
      </table>

      {payOpen && current && (
        <Modal title={`${t("rentals.payments")} — #${current.id}`} onClose={() => setPayOpen(false)}>
          {/* Récapitulatif TVA + solde */}
          <div className="pay-summary">
            <div><span>{t("rentals.ht")}</span><strong>{formatMoney(current.sous_total)}</strong></div>
            <div><span>{t("rentals.tva")} ({Number(current.taux_taxe)}%)</span><strong>{formatMoney(current.montant_taxe)}</strong></div>
            <div className="ttc"><span>{t("rentals.ttc")}</span><strong>{formatMoney(current.montant_total)}</strong></div>
            <div><span>{t("rentals.paid")}</span><strong className="ok">{formatMoney(current.montant_paye)}</strong></div>
            <div><span>{t("rentals.remaining")}</span><strong className="due">{formatMoney(current.montant_restant)}</strong></div>
          </div>

          {/* Liste des paiements */}
          <table className="table mini">
            <thead>
              <tr><th>{t("rentals.date")}</th><th>{t("rentals.amount")}</th><th>{t("rentals.method")}</th><th>{t("rentals.note")}</th><th></th></tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.date_paiement)}</td>
                  <td>{formatMoney(p.montant)}</td>
                  <td>{p.type_paiement?.nom || "-"}</td>
                  <td className="muted">{p.note || "-"}</td>
                  <td className="actions-col">
                    <button className="icon-btn danger" onClick={() => removePayment(p)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr><td colSpan="5" className="empty">{t("rentals.no_payments")}</td></tr>
              )}
            </tbody>
          </table>

          {/* Ajouter un paiement (si reste à payer) */}
          {Number(current.montant_restant) > 0 && (
            <form className="form pay-form" onSubmit={addPayment}>
              <h4>{t("rentals.add_payment")}</h4>
              {payError && <div className="alert">{payError}</div>}
              <div className="form-row">
                <div>
                  <label>{t("rentals.amount")}</label>
                  <input type="number" step="0.01" min="0.01" max={current.montant_restant}
                    value={payForm.montant} onChange={(e) => setPayForm({ ...payForm, montant: e.target.value })} required />
                </div>
                <div>
                  <label>{t("rentals.method")}</label>
                  <select value={payForm.type_paiement_id} onChange={(e) => setPayForm({ ...payForm, type_paiement_id: e.target.value })}>
                    {paymentTypes.map((pt) => <option key={pt.id} value={pt.id}>{pt.nom}</option>)}
                  </select>
                </div>
              </div>
              <label>{t("rentals.note")}</label>
              <input value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} />
              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={saving}>
                  <Plus size={15} /> {saving ? t("common.saving") : t("rentals.add_payment")}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {createOpen && (
        <RentalForm onClose={() => setCreateOpen(false)} onCreated={() => load()} />
      )}
    </div>
  );
}
