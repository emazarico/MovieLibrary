import React, { useEffect, useState } from 'react';
import { Lock, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';
import { useLibrary } from '../../store/LibraryContext';
import type { AvatarTheme, ProfileRole, UserProfile } from '../../types/movie';
import { isProfileAdmin } from '../../utils/admin';
import { verifyPin } from '../../utils/crypto';
import { AVATAR_EMOJIS, AVATAR_THEME_MAP } from '../../utils/themes';
import { Modal } from '../common/Modal';

interface ProfileFormModalProps {
  open: boolean;
  onClose: () => void;
  editProfile?: UserProfile | null;
  adminOverride?: boolean;
  autoLoginOnCreate?: boolean;
}

export const ProfileFormModal: React.FC<ProfileFormModalProps> = ({
  open,
  onClose,
  editProfile,
  adminOverride = false,
  autoLoginOnCreate = true,
}) => {
  const {
    createProfile,
    updateProfile,
    deleteProfile,
    activeProfiles,
    adminProfiles,
    isActiveProfileAdmin,
  } = useLibrary();

  const [name, setName] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('🦉');
  const [avatarTheme, setAvatarTheme] = useState<AvatarTheme>('rose');
  const [role, setRole] = useState<ProfileRole>('member');
  const [yearlyMovieGoal, setYearlyMovieGoal] = useState('40');
  const [monthlyWatchHoursGoal, setMonthlyWatchHoursGoal] = useState('15');

  const [pinMode, setPinMode] = useState<'none' | 'keep' | 'set' | 'remove'>('none');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canManageRoles =
    adminOverride || isActiveProfileAdmin || activeProfiles.length === 0;
  const isLastAdmin = Boolean(
    editProfile &&
      isProfileAdmin(editProfile, activeProfiles) &&
      adminProfiles.length <= 1,
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');

    if (editProfile) {
      setName(editProfile.name);
      setAvatarEmoji(editProfile.avatarEmoji);
      setAvatarTheme(editProfile.avatarTheme);
      setRole(isProfileAdmin(editProfile, activeProfiles) ? 'admin' : 'member');
      setYearlyMovieGoal(String(editProfile.yearlyMovieGoal));
      setMonthlyWatchHoursGoal(String(editProfile.monthlyWatchHoursGoal));
      setPinMode(editProfile.pinHash ? 'keep' : 'none');
    } else {
      setName('');
      setAvatarEmoji(AVATAR_EMOJIS[activeProfiles.length % AVATAR_EMOJIS.length]);
      const themeKeys = Object.keys(AVATAR_THEME_MAP) as AvatarTheme[];
      setAvatarTheme(themeKeys[activeProfiles.length % themeKeys.length]);
      setRole(activeProfiles.length === 0 ? 'admin' : 'member');
      setYearlyMovieGoal('40');
      setMonthlyWatchHoursGoal('15');
      setPinMode('none');
    }
  }, [open, editProfile, activeProfiles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter a viewer name.');
      return;
    }

    if (editProfile?.pinHash && !adminOverride && (pinMode === 'set' || pinMode === 'remove')) {
      const ok = await verifyPin(editProfile.id, currentPin, editProfile.pinHash);
      if (!ok) {
        setError('Current PIN is incorrect.');
        return;
      }
    }

    if (pinMode === 'set') {
      if (!/^\d{4,6}$/.test(newPin)) {
        setError('PIN must be 4 to 6 digits.');
        return;
      }
      if (newPin !== confirmPin) {
        setError('PIN confirmation does not match.');
        return;
      }
    }

    setSaving(true);
    try {
      const movieGoal = Math.max(1, Number(yearlyMovieGoal) || 40);
      const hoursGoal = Math.max(1, Number(monthlyWatchHoursGoal) || 15);

      if (editProfile) {
        await updateProfile(editProfile.id, {
          name: name.trim(),
          avatarEmoji,
          avatarTheme,
          role: canManageRoles ? role : undefined,
          yearlyMovieGoal: movieGoal,
          monthlyWatchHoursGoal: hoursGoal,
          newPin: pinMode === 'set' ? newPin : pinMode === 'remove' ? null : undefined,
        });
      } else {
        await createProfile(
          {
            name: name.trim(),
            avatarEmoji,
            avatarTheme,
            role: canManageRoles ? role : 'member',
            yearlyMovieGoal: movieGoal,
            monthlyWatchHoursGoal: hoursGoal,
            pin: pinMode === 'set' ? newPin : undefined,
          },
          autoLoginOnCreate,
        );
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editProfile) return;
    if (
      window.confirm(
        `Remove "${editProfile.name}" and all their movies/logs from this household?`,
      )
    ) {
      deleteProfile(editProfile.id);
      onClose();
    }
  };

  const themePreview = AVATAR_THEME_MAP[avatarTheme] || AVATAR_THEME_MAP.rose;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editProfile ? `Edit ${editProfile.name}` : 'Create Viewer Profile'}
      subtitle="Each viewer has personal lists, ratings, goals, and watch history."
      maxWidthClass="max-w-md"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="p-5 space-y-5">
        <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/70 dark:border-stone-800">
          <div
            className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${themePreview.gradient} flex items-center justify-center text-2xl shadow-md shrink-0`}
          >
            {avatarEmoji}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-serif-display font-bold text-lg text-stone-900 dark:text-stone-100 truncate">
                {name.trim() || 'New Viewer'}
              </p>
              {role === 'admin' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-800 dark:text-rose-300">
                  <ShieldCheck className="w-3 h-3" /> Admin
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {pinMode === 'set' || pinMode === 'keep' ? 'PIN Protected' : 'Quick 1-Tap Login'}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">
            Viewer Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex"
            autoFocus
            className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-rose-500 outline-none"
          />
        </div>

        {canManageRoles && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">
              Household Role
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                  role === 'admin'
                    ? 'bg-rose-500/12 border-rose-500 text-stone-900 dark:text-stone-100'
                    : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                }`}
              >
                <p className="text-xs font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-600" /> Parent / Admin
                </p>
                <p className="text-[11px] opacity-75 mt-0.5">Can reset forgotten PINs</p>
              </button>

              <button
                type="button"
                disabled={isLastAdmin}
                onClick={() => setRole('member')}
                title={isLastAdmin ? 'At least one Parent / Admin is required' : undefined}
                className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                  role === 'member'
                    ? 'bg-rose-500/12 border-rose-500 text-stone-900 dark:text-stone-100'
                    : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                }`}
              >
                <p className="text-xs font-bold">Viewer</p>
                <p className="text-[11px] opacity-75 mt-0.5">Standard family profile</p>
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">
            Avatar Icon
          </label>
          <div className="grid grid-cols-6 gap-2">
            {AVATAR_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setAvatarEmoji(emoji)}
                className={`h-10 rounded-xl text-lg flex items-center justify-center transition-all cursor-pointer ${
                  avatarEmoji === emoji
                    ? 'bg-rose-500/20 ring-2 ring-rose-500 scale-105'
                    : 'bg-stone-100 dark:bg-stone-800/80 hover:bg-stone-200 dark:hover:bg-stone-700'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">
            Color Theme
          </label>
          <div className="flex flex-wrap gap-2.5">
            {(Object.keys(AVATAR_THEME_MAP) as AvatarTheme[]).map((key) => {
              const item = AVATAR_THEME_MAP[key];
              return (
                <button
                  key={key}
                  type="button"
                  title={item.label}
                  onClick={() => setAvatarTheme(key)}
                  className={`w-8 h-8 rounded-full bg-gradient-to-br ${item.gradient} transition-transform cursor-pointer ${
                    avatarTheme === key
                      ? 'ring-2 ring-offset-2 ring-stone-900 dark:ring-white dark:ring-offset-[#171A23] scale-110'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                />
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
              Yearly Titles Goal
            </label>
            <input
              type="number"
              min={1}
              max={1000}
              value={yearlyMovieGoal}
              onChange={(e) => setYearlyMovieGoal(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
              Monthly Hours Goal
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={monthlyWatchHoursGoal}
              onChange={(e) => setMonthlyWatchHoursGoal(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                Profile PIN Lock
              </span>
            </div>

            {!editProfile?.pinHash ? (
              <button
                type="button"
                onClick={() => setPinMode((m) => (m === 'set' ? 'none' : 'set'))}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  pinMode === 'set'
                    ? 'bg-rose-600 text-white'
                    : 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                }`}
              >
                {pinMode === 'set' ? 'PIN Enabled' : 'Add Optional PIN'}
              </button>
            ) : (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setPinMode((m) => (m === 'set' ? 'keep' : 'set'))}
                  className={`text-xs font-semibold px-2 py-1 rounded-lg cursor-pointer ${
                    pinMode === 'set'
                      ? 'bg-rose-600 text-white'
                      : 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={() => setPinMode((m) => (m === 'remove' ? 'keep' : 'remove'))}
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg cursor-pointer ${
                    pinMode === 'remove'
                      ? 'bg-rose-600 text-white'
                      : 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <ShieldOff className="w-3 h-3" /> Remove
                </button>
              </div>
            )}
          </div>

          {editProfile?.pinHash && !adminOverride && (pinMode === 'set' || pinMode === 'remove') && (
            <div>
              <label className="block text-xs text-stone-500 dark:text-stone-400 mb-1">
                Verify Current PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Current PIN"
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-sm outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          )}

          {pinMode === 'set' && (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs text-stone-500 dark:text-stone-400 mb-1">
                  New PIN (4–6 digits)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-sm outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 dark:text-stone-400 mb-1">
                  Confirm PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-sm outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>
        )}

        <div className="flex items-center justify-between pt-2 gap-3">
          {editProfile && !isLastAdmin ? (
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Profile
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving…' : editProfile ? 'Save Changes' : 'Create & Open'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
