import { useState, useEffect } from 'react';
import api from '../../api/client';
import { useToast } from '../../components/toast/ToastContext';
import {
  AlertTriangle,
  Check,
  X,
  Loader2,
  Shield,
  Smartphone,
  Copy,
  RefreshCw,
  Key,
} from 'lucide-react';

function MFASection() {
  const toast = useToast();

  const [mfaStatus, setMfaStatus] = useState({ enabled: false, remainingBackupCodes: 0, enabledAt: null });
  const [mfaLoading, setMfaLoading] = useState(true);
  const [mfaStep, setMfaStep] = useState('idle'); // idle | setup | verify | backupCodes | disable | regenerate
  const [mfaSetup, setMfaSetup] = useState(null); // { qrCode, manualEntry }
  const [mfaCode, setMfaCode] = useState('');
  const [mfaPassword, setMfaPassword] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [mfaError, setMfaError] = useState('');
  const [mfaProcessing, setMfaProcessing] = useState(false);
  const [backupCodesCopied, setBackupCodesCopied] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);

  // Load MFA status
  useEffect(() => {
    const loadMfaStatus = async () => {
      try {
        const result = await api.get('/mfa/status');
        setMfaStatus(result);
      } catch {
        // MFA status is optional - don't show error toast
      } finally {
        setMfaLoading(false);
      }
    };
    loadMfaStatus();
  }, []);

  const startMfaSetup = async () => {
    setMfaStep('setup');
    setMfaError('');
    setMfaProcessing(true);
    try {
      const result = await api.post('/mfa/setup');
      setMfaSetup(result);
      setMfaStep('verify');
    } catch (err) {
      setMfaError(err.response?.data?.error || 'Failed to start MFA setup');
      setMfaStep('idle');
    } finally {
      setMfaProcessing(false);
    }
  };

  const verifyAndEnableMfa = async () => {
    if (!mfaCode || mfaCode.length !== 6) {
      setMfaError('Please enter a 6-digit code');
      return;
    }
    setMfaError('');
    setMfaProcessing(true);
    try {
      const result = await api.post('/mfa/enable', { code: mfaCode });
      setBackupCodes(result.backupCodes || []);
      setMfaStatus({ ...mfaStatus, enabled: true, remainingBackupCodes: 10 });
      setMfaStep('backupCodes');
      toast.success('MFA enabled successfully');
    } catch (err) {
      setMfaError(err.response?.data?.error || 'Invalid verification code');
    } finally {
      setMfaProcessing(false);
    }
  };

  const disableMfa = async () => {
    if (!mfaPassword) {
      setMfaError('Password is required');
      return;
    }
    if (!mfaCode || mfaCode.length !== 6) {
      setMfaError('Please enter a 6-digit MFA code');
      return;
    }
    setMfaError('');
    setMfaProcessing(true);
    try {
      await api.post('/mfa/disable', { password: mfaPassword, code: mfaCode });
      setMfaStatus({ enabled: false, remainingBackupCodes: 0, enabledAt: null });
      resetMfaState();
      toast.success('MFA disabled successfully');
    } catch (err) {
      setMfaError(err.response?.data?.error || 'Failed to disable MFA');
    } finally {
      setMfaProcessing(false);
    }
  };

  const regenerateBackupCodes = async () => {
    if (!mfaPassword) {
      setMfaError('Password is required');
      return;
    }
    if (!mfaCode || mfaCode.length !== 6) {
      setMfaError('Please enter a 6-digit MFA code');
      return;
    }
    setMfaError('');
    setMfaProcessing(true);
    try {
      const result = await api.post('/mfa/backup-codes/regenerate', { password: mfaPassword, code: mfaCode });
      setBackupCodes(result.backupCodes || []);
      setMfaStatus({ ...mfaStatus, remainingBackupCodes: 10 });
      setMfaStep('backupCodes');
      toast.success('Backup codes regenerated successfully');
    } catch (err) {
      setMfaError(err.response?.data?.error || 'Failed to regenerate backup codes');
    } finally {
      setMfaProcessing(false);
    }
  };

  const copyBackupCodes = async () => {
    const codesText = backupCodes.join('\n');
    try {
      await navigator.clipboard.writeText(codesText);
      setBackupCodesCopied(true);
      setTimeout(() => setBackupCodesCopied(false), 2000);
      toast.success('Backup codes copied to clipboard');
    } catch {
      toast.error('Failed to copy codes');
    }
  };

  const resetMfaState = () => {
    setMfaStep('idle');
    setMfaSetup(null);
    setMfaCode('');
    setMfaPassword('');
    setBackupCodes([]);
    setMfaError('');
    setShowManualEntry(false);
  };

  return (
    <div className="bg-card rounded-lg shadow p-6 mb-6" data-testid="settings-mfa">
      <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5" />
        Two-Factor Authentication (2FA)
      </h3>

      {mfaLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
        </div>
      ) : mfaStep === 'idle' ? (
        // Status display
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${mfaStatus.enabled ? 'bg-gain' : 'bg-text-muted'}`} />
              <div>
                <div className="font-medium text-text-primary">
                  {mfaStatus.enabled ? '2FA is enabled' : '2FA is not enabled'}
                </div>
                {mfaStatus.enabled && mfaStatus.enabledAt && (
                  <div className="text-sm text-text-muted">
                    Enabled on {new Date(mfaStatus.enabledAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
            {mfaStatus.enabled ? (
              <button
                onClick={() => setMfaStep('disable')}
                className="px-4 py-2 text-loss border border-loss rounded-lg hover:bg-loss/10"
              >
                Disable 2FA
              </button>
            ) : (
              <button
                onClick={startMfaSetup}
                disabled={mfaProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50"
              >
                {mfaProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                Enable 2FA
              </button>
            )}
          </div>

          {mfaStatus.enabled && (
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-text-primary flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Backup Codes
                  </div>
                  <div className="text-sm text-text-muted">
                    {mfaStatus.remainingBackupCodes} of 10 codes remaining
                  </div>
                </div>
                <button
                  onClick={() => setMfaStep('regenerate')}
                  className="flex items-center gap-2 px-4 py-2 bg-page-bg text-text-primary border border-border rounded-lg hover:bg-gray-100"
                >
                  <RefreshCw className="w-4 h-4" />
                  Regenerate
                </button>
              </div>
              {mfaStatus.remainingBackupCodes <= 2 && (
                <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  You have few backup codes remaining. Consider regenerating them.
                </div>
              )}
            </div>
          )}
        </div>
      ) : mfaStep === 'verify' && mfaSetup ? (
        // Setup flow - QR code and verification
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-text-secondary mb-4">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>
            <div className="inline-block p-4 bg-white rounded-lg shadow-sm">
              <img src={mfaSetup.qrCode} alt="MFA QR Code" className="w-48 h-48" />
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={() => setShowManualEntry(!showManualEntry)}
              className="text-sm text-brand hover:underline"
            >
              {showManualEntry ? 'Hide manual entry key' : "Can't scan? Enter key manually"}
            </button>
            {showManualEntry && mfaSetup.manualEntry && (
              <div className="mt-3 p-3 bg-page-bg rounded-lg">
                <p className="text-sm text-text-muted mb-1">Manual entry key:</p>
                <code className="text-sm font-mono text-text-primary break-all">
                  {mfaSetup.manualEntry.key}
                </code>
              </div>
            )}
          </div>

          <div className="max-w-xs mx-auto">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Enter the 6-digit code from your app
            </label>
            <input
              type="text"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border border-line rounded-md bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {mfaError && (
            <div className="p-3 bg-loss/10 border border-loss text-loss rounded-md text-sm text-center">
              {mfaError}
            </div>
          )}

          <div className="flex justify-center gap-3">
            <button
              onClick={resetMfaState}
              className="px-4 py-2 text-text-secondary border border-border rounded-lg hover:bg-page-bg"
            >
              Cancel
            </button>
            <button
              onClick={verifyAndEnableMfa}
              disabled={mfaProcessing || mfaCode.length !== 6}
              className="flex items-center gap-2 px-6 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50"
            >
              {mfaProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Verify & Enable
            </button>
          </div>
        </div>
      ) : mfaStep === 'backupCodes' && backupCodes.length > 0 ? (
        // Backup codes display
        <div className="space-y-6">
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  Save these backup codes securely
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  These codes will only be shown once. Each code can be used once to sign in if you lose access to your authenticator app.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 p-4 bg-page-bg rounded-lg">
            {backupCodes.map((code, i) => (
              <code key={i} className="px-3 py-2 bg-white dark:bg-gray-800 rounded text-sm font-mono text-center text-text-primary">
                {code}
              </code>
            ))}
          </div>

          <div className="flex justify-center gap-3">
            <button
              onClick={copyBackupCodes}
              className="flex items-center gap-2 px-4 py-2 bg-page-bg text-text-primary border border-border rounded-lg hover:bg-gray-100"
            >
              {backupCodesCopied ? <Check className="w-4 h-4 text-gain" /> : <Copy className="w-4 h-4" />}
              {backupCodesCopied ? 'Copied!' : 'Copy All Codes'}
            </button>
            <button
              onClick={resetMfaState}
              className="px-6 py-2 bg-brand text-white rounded-lg hover:bg-brand/90"
            >
              Done
            </button>
          </div>
        </div>
      ) : (mfaStep === 'disable' || mfaStep === 'regenerate') ? (
        // Disable/Regenerate flow - requires password and MFA code
        <div className="space-y-4 max-w-md mx-auto">
          <div className="text-center mb-6">
            <p className="text-text-secondary">
              {mfaStep === 'disable'
                ? 'To disable 2FA, please verify your identity'
                : 'To regenerate backup codes, please verify your identity'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={mfaPassword}
              onChange={(e) => setMfaPassword(e.target.value)}
              className="w-full px-3 py-2 border border-line rounded-md bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="Enter your password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              MFA Code
            </label>
            <input
              type="text"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="w-full px-3 py-2 text-center font-mono tracking-widest border border-line rounded-md bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {mfaError && (
            <div className="p-3 bg-loss/10 border border-loss text-loss rounded-md text-sm">
              {mfaError}
            </div>
          )}

          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={resetMfaState}
              className="px-4 py-2 text-text-secondary border border-border rounded-lg hover:bg-page-bg"
            >
              Cancel
            </button>
            <button
              onClick={mfaStep === 'disable' ? disableMfa : regenerateBackupCodes}
              disabled={mfaProcessing || !mfaPassword || mfaCode.length !== 6}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg disabled:opacity-50 ${
                mfaStep === 'disable'
                  ? 'bg-loss text-white hover:bg-loss/90'
                  : 'bg-brand text-white hover:bg-brand/90'
              }`}
            >
              {mfaProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mfaStep === 'disable' ? (
                <X className="w-4 h-4" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {mfaStep === 'disable' ? 'Disable 2FA' : 'Regenerate Codes'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default MFASection;
