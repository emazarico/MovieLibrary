import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Gift,
  KeyRound,
  Lock,
  Pencil,
  ShieldCheck,
  Trash2,
  Tv,
  UserPlus,
} from 'lucide-react';
import { useLibrary } from '../../store/LibraryContext';
import type { UserProfile } from '../../types/movie';
import { isProfileAdmin } from '../../utils/admin';
import { WATCH_BADGE_DEFINITIONS } from '../../utils/badges';
import { verifyPin } from '../../utils/crypto';
import {
  AVATAR_THEME_MAP,
  POPULAR_STREAMING_SERVICES,
  STREAMING_REGIONS,
} from '../../utils/themes';
import { Modal } from '../common/Modal';
import { ProfileFormModal } from './ProfileFormModal';

interface HouseholdAdminModalProps {
  open: boolean;
  onClose: () => void;
}

export const HouseholdAdminModal: React.FC<HouseholdAdminModalProps> = ({ open, onClose }) => {
  const {
    db,
    activeProfiles,
    adminProfiles,
    activeProfile,
    isActiveProfileAdmin,
    householdSettings,
    updateHouseholdSettings,
    adminResetUserPin,
    updateProfile,
    setProfileRole,
    deleteProfile,
    addToast,
  } = useLibrary();

  const [verifiedAdminId, setVerifiedAdminId] = useState<string | null>(null);
  const [verifiedAdminPin, setVerifiedAdminPin] = useState<string | null>(null);
  const [gateAdminId, setGateAdminId] = useState<string>('');
  const [gatePin, setGatePin] = useState('');
  const [gateError, setGateError] = useState<string | null>(null);

  const [pinResetTargetId, setPinResetTargetId] = useState<string | null>(null);
  const [newPinDraft, setNewPinDraft] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [rewardsTargetId, setRewardsTargetId] = useState<string | null>(null);
  const [rewardDrafts, setRewardDrafts] = useState<Record<string, string>>({});

  const [editTarget, setEditTarget] = useState<UserProfile | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setGateError(null);
    setGatePin('');
    setPinResetTargetId(null);
    setNewPinDraft('');
    setPinError(null);
    setRewardsTargetId(null);
    setRewardDrafts({});

    if (activeProfile && isActiveProfileAdmin) {
      setVerifiedAdminId(activeProfile.id);
      setVerifiedAdminPin(null);
    } else {
      setVerifiedAdminId(null);
      setVerifiedAdminPin(null);
      setGateAdminId(adminProfiles[0]?.id || '');
    }
  }, [open, activeProfile, isActiveProfileAdmin, adminProfiles]);

  const currentGateAdmin =
    adminProfiles.find((a) => a.id === gateAdminId) || adminProfiles[0] || null;
  const actingAdmin =
    adminProfiles.find((a) => a.id === verifiedAdminId) ||
    (isActiveProfileAdmin ? activeProfile : null);
  const isAuthorized = Boolean(
    actingAdmin && (isActiveProfileAdmin || verifiedAdminId !== null),
  );

  const handleGateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGateAdmin) return;
    setGateError(null);

    if (currentGateAdmin.pinHash) {
      const ok = await verifyPin(currentGateAdmin.id, gatePin, currentGateAdmin.pinHash);
      if (!ok) {
        setGateError('Incorrect Admin PIN.');
        return;
      }
      setVerifiedAdminPin(gatePin);
    } else {
      setVerifiedAdminPin(null);
    }
    setVerifiedAdminId(currentGateAdmin.id);
  };

  const handleSaveTargetPin = async (target: UserProfile, pinValue: string | null) => {
    if (!actingAdmin) return;
    setPinError(null);

    if (pinValue !== null && !/^\d{4,6}$/.test(pinValue.trim())) {
      setPinError('PIN must be 4 to 6 digits.');
      return;
    }

    let result: { ok: boolean; error?: string };
    if (actingAdmin.id === activeProfile?.id) {
      await updateProfile(target.id, { newPin: pinValue });
      result = { ok: true };
    } else {
      result = await adminResetUserPin(
        actingAdmin.id,
        verifiedAdminPin,
        target.id,
        pinValue,
        false,
      );
    }

    if (!result.ok) {
      setPinError(result.error || 'Could not update PIN.');
      return;
    }

    setPinResetTargetId(null);
    setNewPinDraft('');
  };

  const handleSaveRewards = async (target: UserProfile) => {
    const cleaned: Record<string, string> = {};
    for (const def of WATCH_BADGE_DEFINITIONS) {
      const val = rewardDrafts[def.id]?.trim();
      if (val) {
        cleaned[def.id] = val;
      }
    }
    await updateProfile(target.id, { badgeRewards: cleaned });
    addToast({
      title: `Saved rewards for ${target.name}`,
      tone: 'success',
    });
    setRewardsTargetId(null);
  };

  const toggleHouseholdService = (service: string) => {
    const cur = householdSettings.subscribedServices;
    const exists = cur.some((s) => s.toLowerCase() === service.toLowerCase());
    updateHouseholdSettings({
      subscribedServices: exists
        ? cur.filter((s) => s.toLowerCase() !== service.toLowerCase())
        : [...cur, service],
    });
  };

  const unprotectedAdmin = adminProfiles.some((a) => !a.pinHash);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Parent & Household Admin"
      subtitle="Manage viewer roles, reset forgotten PINs, configure badge rewards, and set household streaming services."
      maxWidthClass="max-w-xl"
    >
      <div className="p-5 space-y-5">
        {!isAuthorized ? (
          adminProfiles.length === 0 ? (
            <p className="text-sm text-stone-500 text-center py-6">
              Create your first viewer profile to enable Household Admin controls.
            </p>
          ) : (
            <form onSubmit={(e) => void handleGateSubmit(e)} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-900 dark:text-rose-200">
                <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p>
                  Verify a <strong>Parent / Admin</strong> account to view household controls or
                  reset forgotten viewer PINs.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">
                  Admin Profile
                </label>
                <select
                  value={currentGateAdmin?.id || ''}
                  onChange={(e) => {
                    setGateAdminId(e.target.value);
                    setGatePin('');
                    setGateError(null);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm font-medium text-stone-900 dark:text-stone-100 outline-none"
                >
                  {adminProfiles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.avatarEmoji} {a.name} {a.pinHash ? '(PIN Locked)' : '(No PIN)'}
                    </option>
                  ))}
                </select>
              </div>

              {currentGateAdmin?.pinHash ? (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">
                    {currentGateAdmin.name}&apos;s PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    autoFocus
                    value={gatePin}
                    onChange={(e) => setGatePin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter Admin PIN"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              ) : (
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {currentGateAdmin?.name} has no PIN yet. You can set one once inside.
                </p>
              )}

              {gateError && (
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{gateError}</p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                >
                  {currentGateAdmin?.pinHash
                    ? 'Unlock Admin Controls'
                    : `Continue as ${currentGateAdmin?.name}`}
                </button>
              </div>
            </form>
          )
        ) : (
          <>
            {unprotectedAdmin && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  Tip: Set a PIN on every <strong>Parent / Admin</strong> profile so viewers cannot
                  open Admin Controls or reset PINs unauthenticated.
                </p>
              </div>
            )}

            {/* Household Streaming Subscriptions */}
            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 flex items-center gap-1.5">
                  <Tv className="w-3.5 h-3.5 text-rose-600" /> Household Streaming Subscriptions
                </span>
                <select
                  value={householdSettings.streamingRegion}
                  onChange={(e) => updateHouseholdSettings({ streamingRegion: e.target.value })}
                  aria-label="Streaming region"
                  className="px-2 py-1 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-[11px] font-semibold outline-none"
                >
                  {STREAMING_REGIONS.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_STREAMING_SERVICES.slice(0, 10).map((svc) => {
                  const active = householdSettings.subscribedServices.some(
                    (s) => s.toLowerCase() === svc.toLowerCase(),
                  );
                  return (
                    <button
                      key={svc}
                      type="button"
                      onClick={() => toggleHouseholdService(svc)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                        active
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                      }`}
                    >
                      {active && <Check className="w-2.5 h-2.5" />}
                      {svc}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Household Viewers ({activeProfiles.length})
              </span>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" /> Add Viewer
              </button>
            </div>

            <div className="space-y-3">
              {activeProfiles.map((member) => {
                const meta = AVATAR_THEME_MAP[member.avatarTheme] || AVATAR_THEME_MAP.rose;
                const memberIsAdmin = isProfileAdmin(member, activeProfiles);
                const isOnlyAdmin = memberIsAdmin && adminProfiles.length <= 1;
                const titleCount = db.movies.filter(
                  (m) => m.profileId === member.id && !m.deletedAt,
                ).length;
                const isResetOpen = pinResetTargetId === member.id;
                const isRewardsOpen = rewardsTargetId === member.id;
                const rewardCount = Object.values(member.badgeRewards || {}).filter((v) =>
                  v?.trim(),
                ).length;

                return (
                  <div
                    key={member.id}
                    className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center text-lg shrink-0`}
                        >
                          {member.avatarEmoji}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-sm text-stone-900 dark:text-stone-100 truncate">
                              {member.name}
                            </span>
                            {memberIsAdmin ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-800 dark:text-rose-300">
                                <ShieldCheck className="w-3 h-3" /> Parent / Admin
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-200/80 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                                Viewer
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                            {titleCount} {titleCount === 1 ? 'title' : 'titles'} ·{' '}
                            {member.pinHash ? (
                              <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400 font-medium">
                                <Lock className="w-3 h-3" /> PIN Locked
                              </span>
                            ) : (
                              'No PIN'
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setPinResetTargetId(isResetOpen ? null : member.id);
                            setNewPinDraft('');
                            setPinError(null);
                            setRewardsTargetId(null);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:border-rose-400 text-xs font-semibold text-stone-700 dark:text-stone-200 cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-rose-600" />
                          {member.pinHash ? 'Reset PIN' : 'Set PIN'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (isRewardsOpen) {
                              setRewardsTargetId(null);
                            } else {
                              setRewardsTargetId(member.id);
                              setRewardDrafts({ ...(member.badgeRewards || {}) });
                              setPinResetTargetId(null);
                            }
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                            isRewardsOpen
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 hover:border-rose-400 text-stone-700 dark:text-stone-200'
                          }`}
                        >
                          <Gift className={`w-3.5 h-3.5 ${isRewardsOpen ? 'text-white' : 'text-rose-500'}`} />
                          <span>Rewards</span>
                          {rewardCount > 0 && (
                            <span
                              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                isRewardsOpen
                                  ? 'bg-white/25 text-white'
                                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                              }`}
                            >
                              {rewardCount}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={isOnlyAdmin}
                          title={
                            isOnlyAdmin
                              ? 'At least one Parent / Admin is required'
                              : memberIsAdmin
                                ? 'Change to standard Viewer'
                                : 'Promote to Parent / Admin'
                          }
                          onClick={() =>
                            setProfileRole(member.id, memberIsAdmin ? 'member' : 'admin')
                          }
                          className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:border-rose-400 text-xs font-semibold text-stone-700 dark:text-stone-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {memberIsAdmin ? 'Make Viewer' : 'Make Admin'}
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditTarget(member)}
                          title="Edit profile"
                          className="p-1.5 rounded-xl text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 hover:bg-stone-200/70 dark:hover:bg-stone-800 cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          disabled={isOnlyAdmin}
                          title={
                            isOnlyAdmin ? 'Cannot delete the sole Admin' : 'Delete viewer profile'
                          }
                          onClick={() => {
                            if (
                              window.confirm(
                                `Remove "${member.name}" and all their movies/logs from this household?`,
                              )
                            ) {
                              deleteProfile(member.id);
                            }
                          }}
                          className="p-1.5 rounded-xl text-stone-400 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {isResetOpen && (
                      <div className="pt-2.5 border-t border-stone-200/70 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center gap-2">
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          value={newPinDraft}
                          onChange={(e) => setNewPinDraft(e.target.value.replace(/\D/g, ''))}
                          placeholder="New 4–6 digit PIN"
                          className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-xs outline-none focus:ring-2 focus:ring-rose-500"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSaveTargetPin(member, newPinDraft)}
                            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                          >
                            Save PIN
                          </button>
                          {member.pinHash && (
                            <button
                              type="button"
                              onClick={() => void handleSaveTargetPin(member, null)}
                              className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-semibold cursor-pointer"
                            >
                              Remove PIN
                            </button>
                          )}
                        </div>
                        {pinError && (
                          <p className="text-xs text-rose-600 dark:text-rose-400 w-full">
                            {pinError}
                          </p>
                        )}
                      </div>
                    )}

                    {isRewardsOpen && (
                      <div className="pt-3 border-t border-stone-200/70 dark:border-stone-800 space-y-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                          <Gift className="w-3.5 h-3.5" />
                          Milestone Reward Notes for {member.name}
                        </p>
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                          {WATCH_BADGE_DEFINITIONS.map((def) => (
                            <div
                              key={def.id}
                              className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2.5"
                            >
                              <span className="text-xs font-medium text-stone-700 dark:text-stone-200 sm:w-44 shrink-0 truncate">
                                {def.emoji} {def.title}
                              </span>
                              <input
                                type="text"
                                value={rewardDrafts[def.id] || ''}
                                onChange={(e) =>
                                  setRewardDrafts((prev) => ({
                                    ...prev,
                                    [def.id]: e.target.value,
                                  }))
                                }
                                placeholder="Optional reward (e.g. Pick Friday pizza & movie)…"
                                className="flex-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setRewardsTargetId(null)}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium text-stone-500 hover:bg-stone-200/70 dark:hover:bg-stone-800 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSaveRewards(member)}
                            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                          >
                            Save Rewards
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <ProfileFormModal
        open={editTarget !== null || createOpen}
        onClose={() => {
          setEditTarget(null);
          setCreateOpen(false);
        }}
        editProfile={editTarget}
        adminOverride={true}
        autoLoginOnCreate={false}
      />
    </Modal>
  );
};
