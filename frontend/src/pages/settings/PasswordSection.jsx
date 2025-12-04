import { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
import { useToast } from '../../components/toast/ToastContext';
import {
  Lock,
  Eye,
  EyeOff,
  X,
  Check,
  Loader2,
} from 'lucide-react';

function PasswordSection() {
  const toast = useToast();

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(null);

  // Check password strength
  const checkPasswordStrength = useCallback(async (password) => {
    if (!password || password.length < 4) {
      setPasswordStrength(null);
      return;
    }
    try {
      const result = await api.post('/auth/check-password', { password });
      setPasswordStrength(result);
    } catch {
      setPasswordStrength(null);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      checkPasswordStrength(passwordForm.newPassword);
    }, 300);
    return () => clearTimeout(timeout);
  }, [passwordForm.newPassword, checkPasswordStrength]);

  // Change password
  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!passwordStrength?.valid) {
      toast.error('Password does not meet requirements');
      return;
    }

    setPasswordChanging(true);
    try {
      await api.put('/auth/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordStrength(null);
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to change password';
      toast.error(message);
    } finally {
      setPasswordChanging(false);
    }
  };

  const getStrengthColor = (score) => {
    if (score <= 1) return 'bg-loss';
    if (score <= 2) return 'bg-amber-500';
    if (score <= 3) return 'bg-amber-400';
    return 'bg-gain';
  };

  const getStrengthText = (score) => {
    if (score <= 1) return 'Weak';
    if (score <= 2) return 'Fair';
    if (score <= 3) return 'Good';
    return 'Strong';
  };

  return (
    <div className="bg-card rounded-lg shadow p-6 mb-6" data-testid="settings-password">
      <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-4">
        <Lock className="w-5 h-5" />
        Change Password
      </h3>

      <form onSubmit={handleChangePassword} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">
            Current Password
          </label>
          <div className="relative">
            <input
              type={showPasswords.current ? 'text' : 'password'}
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
              className="w-full px-3 py-2 pr-10 bg-page-bg border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-brand focus:border-transparent"
              required
            />
            <button
              type="button"
              onClick={() => setShowPasswords(s => ({ ...s, current: !s.current }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">
            New Password
          </label>
          <div className="relative">
            <input
              type={showPasswords.new ? 'text' : 'password'}
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
              className="w-full px-3 py-2 pr-10 bg-page-bg border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-brand focus:border-transparent"
              required
            />
            <button
              type="button"
              onClick={() => setShowPasswords(s => ({ ...s, new: !s.new }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {passwordStrength && (
            <div className="mt-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getStrengthColor(passwordStrength.score)} transition-all`}
                    style={{ width: `${(passwordStrength.score + 1) * 20}%` }}
                  />
                </div>
                <span className={`text-xs font-medium ${
                  passwordStrength.valid ? 'text-gain' : 'text-loss'
                }`}>
                  {getStrengthText(passwordStrength.score)}
                </span>
              </div>
              {passwordStrength.errors?.map((error, i) => (
                <p key={i} className="text-xs text-loss flex items-center gap-1">
                  <X className="w-3 h-3" /> {error}
                </p>
              ))}
              {passwordStrength.valid && (
                <p className="text-xs text-gain flex items-center gap-1">
                  <Check className="w-3 h-3" /> Password meets requirements
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">
            Confirm New Password
          </label>
          <div className="relative">
            <input
              type={showPasswords.confirm ? 'text' : 'password'}
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
              className="w-full px-3 py-2 pr-10 bg-page-bg border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-brand focus:border-transparent"
              required
            />
            <button
              type="button"
              onClick={() => setShowPasswords(s => ({ ...s, confirm: !s.confirm }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
            <p className="text-xs text-loss mt-1 flex items-center gap-1">
              <X className="w-3 h-3" /> Passwords do not match
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={passwordChanging || !passwordStrength?.valid || passwordForm.newPassword !== passwordForm.confirmPassword}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50"
        >
          {passwordChanging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
          Change Password
        </button>
      </form>
    </div>
  );
}

export default PasswordSection;
