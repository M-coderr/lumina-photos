import React, { useState } from 'react';
import { 
  X, 
  Power, 
  ShieldCheck, 
  Sparkles, 
  CreditCard, 
  Lock, 
  CheckCircle, 
  AlertTriangle 
} from 'lucide-react';
import { updateAdminSwitch } from '../api';

export default function AdminSwitchModal({ isOpen, onClose, currentLicense, onRefreshStats }) {
  const [selectedStatus, setSelectedStatus] = useState(currentLicense?.status || 'active');
  const [selectedPlan, setSelectedPlan] = useState(currentLicense?.plan_type || 'pro_trial');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  if (!isOpen) return null;

  const handleApplySwitch = async () => {
    try {
      setSaving(true);
      setMessage(null);
      await updateAdminSwitch(selectedStatus, selectedPlan);
      setMessage({ type: 'success', text: `Server switch updated to ${selectedStatus.toUpperCase()}` });
      if (onRefreshStats) onRefreshStats();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.detail || 'Failed to update switch' });
    } finally {
      setSaving(false);
    }
  };

  const statuses = [
    {
      id: 'active',
      title: 'Active (Pro / Paid)',
      desc: 'All remote sync, uploads, and AI features enabled.',
      color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
    },
    {
      id: 'trial',
      title: 'Free Trial',
      desc: 'Initial roll-out free period for new users.',
      color: 'border-blue-500/40 bg-blue-500/10 text-blue-400',
    },
    {
      id: 'paused',
      title: 'Paused (The Switch)',
      desc: 'Blocks uploads and remote sync until subscription renews. Library stays read-only.',
      color: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
    },
    {
      id: 'expired',
      title: 'Expired / Unpaid',
      desc: 'Prompts user with paywall upgrade screen.',
      color: 'border-rose-500/40 bg-rose-500/10 text-rose-400',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl animate-in zoom-in-95">
        {/* Header */}
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Power className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">The Server Switch & Monetization</h3>
              <p className="text-xs text-neutral-400">Creator Licensing & Remote Control Engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Privacy Guarantee Banner */}
          <div className="p-3.5 rounded-2xl bg-neutral-800/60 border border-neutral-700/60 flex items-start gap-3 text-xs">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-neutral-300">
              <p className="font-semibold text-white">Zero-Knowledge Architecture</p>
              <p className="text-neutral-400 mt-0.5">
                This switch controls operational status and remote tunnel routing. You (the creator) have zero access to the user's photos, metadata, or database.
              </p>
            </div>
          </div>

          {/* Switch Status Options */}
          <div>
            <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block mb-2">
              Server Status Switch
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {statuses.map((s) => {
                const isSelected = selectedStatus === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedStatus(s.id)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? `${s.color} ring-2 ring-blue-500/50`
                        : 'border-neutral-800 bg-neutral-800/40 hover:bg-neutral-800/80 text-neutral-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-white">{s.title}</span>
                      {isSelected && <CheckCircle className="w-4 h-4 text-blue-400" />}
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-1 leading-snug">{s.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monetization Tier Selection */}
          <div>
            <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block mb-2">
              Subscription Plan Tier
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { id: 'free_tier', label: 'Free Tier', price: '$0' },
                { id: 'pro_monthly', label: 'Pro Monthly', price: '$3.99/mo' },
                { id: 'pro_yearly', label: 'Pro Yearly', price: '$35/yr' },
                { id: 'lifetime', label: 'Lifetime', price: '$89 once' },
              ].map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    selectedPlan === plan.id
                      ? 'border-blue-500 bg-blue-600/15 text-white font-medium'
                      : 'border-neutral-800 bg-neutral-800/40 text-neutral-400 hover:text-white'
                  }`}
                >
                  <div className="font-semibold">{plan.label}</div>
                  <div className="text-[11px] text-blue-400 mt-0.5">{plan.price}</div>
                </button>
              ))}
            </div>
          </div>

          {message && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span>{message.text}</span>
            </div>
          )}

          {/* Apply Button */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleApplySwitch}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Applying...' : 'Apply Status Switch'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
