import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { LogoFull } from '../components/Logo';

function MFAVerificationPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const inputRef = useRef(null);

  const verifyMFA = useAuthStore((state) => state.verifyMFA);
  const error = useAuthStore((state) => state.error);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const mfaRequired = useAuthStore((state) => state.mfaRequired);
  const clearMfaState = useAuthStore((state) => state.clearMfaState);
  const clearError = useAuthStore((state) => state.clearError);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Redirect back to login if MFA is not required
  useEffect(() => {
    if (!mfaRequired && !isAuthenticated) {
      navigate('/login');
    }
  }, [mfaRequired, isAuthenticated, navigate]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Clear error when switching between TOTP and backup
  useEffect(() => {
    clearError();
    // Use setTimeout to avoid setState in effect body
    const timeout = setTimeout(() => setCode(''), 0);
    return () => clearTimeout(timeout);
  }, [useBackup, clearError]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const result = await verifyMFA(code, useBackup);
    if (result.success) {
      navigate('/dashboard');
    }
  };

  const handleCancel = () => {
    clearMfaState();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center p-4">
      <div className="bg-card p-8 rounded-lg shadow-lg w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-2">
            <LogoFull size="lg" />
          </div>
          <h1 className="text-xl font-semibold text-text-primary mb-2">
            Two-Factor Authentication
          </h1>
          <p className="text-text-muted text-sm">
            {useBackup
              ? 'Enter one of your backup codes'
              : 'Enter the 6-digit code from your authenticator app'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="code"
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              {useBackup ? 'Backup Code' : 'Authentication Code'}
            </label>
            <input
              ref={inputRef}
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
              required
              autoComplete="one-time-code"
              className="w-full px-3 py-2 border border-line rounded-md bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-brand text-center text-2xl tracking-widest font-mono"
              placeholder={useBackup ? 'XXXX-XXXX' : '000000'}
              maxLength={useBackup ? 9 : 6}
            />
          </div>

          {error && (
            <div className="p-3 bg-loss/10 border border-loss text-loss rounded-md text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || code.length < (useBackup ? 8 : 6)}
            className="w-full py-2 px-4 bg-brand text-white font-medium rounded-md hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Verifying...' : 'Verify'}
          </button>
        </form>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => setUseBackup(!useBackup)}
            className="w-full text-sm text-brand hover:underline"
          >
            {useBackup
              ? 'Use authenticator app instead'
              : "Can't access your authenticator? Use a backup code"}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={handleCancel}
              className="text-sm text-text-muted hover:text-text-secondary"
            >
              Cancel and return to login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MFAVerificationPage;
