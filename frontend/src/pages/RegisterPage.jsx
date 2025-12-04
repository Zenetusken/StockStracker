import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { LogoFull } from '../components/Logo';
import api from '../api/client';
import { X, AlertTriangle } from 'lucide-react';

// Password strength color helpers
const getStrengthColor = (score) => {
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500'];
  return colors[score] || colors[0];
};

const getStrengthTextColor = (score) => {
  const colors = ['text-red-500', 'text-orange-500', 'text-yellow-500', 'text-lime-500', 'text-green-500'];
  return colors[score] || colors[0];
};

function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(null);
  const [checkingStrength, setCheckingStrength] = useState(false);

  const register = useAuthStore((state) => state.register);
  const error = useAuthStore((state) => state.error);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const clearError = useAuthStore((state) => state.clearError);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Clear error on unmount
  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  // Debounced password strength check
  useEffect(() => {
    if (password.length >= 4) {
      setCheckingStrength(true);
      const timer = setTimeout(async () => {
        try {
          const res = await api.post('/api/auth/check-password', { password });
          setPasswordStrength(res.data);
        } catch (err) {
          // Silently fail - validation will happen on submit
          console.error('Password check failed:', err);
        } finally {
          setCheckingStrength(false);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setPasswordStrength(null);
      setCheckingStrength(false);
    }
  }, [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    // Validate password match
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    // Validate password length (must match backend: 12 chars)
    if (password.length < 12) {
      setValidationError('Password must be at least 12 characters');
      return;
    }

    // Validate password strength (must be score >= 3)
    if (passwordStrength && passwordStrength.score < 3) {
      setValidationError('Password is too weak. Please choose a stronger password.');
      return;
    }

    try {
      await register(email, password);
      navigate('/dashboard');
    } catch {
      // Error is already set in the store
    }
  };

  // Show either validation error or store error
  const displayError = validationError || error;

  // Check if password is strong enough to submit
  const isPasswordStrong = passwordStrength?.score >= 3;
  const canSubmit = email && password && confirmPassword &&
                    password === confirmPassword &&
                    password.length >= 12 &&
                    isPasswordStrong &&
                    !isLoading;

  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center p-4">
      <div className="bg-card p-8 rounded-lg shadow-lg w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-2">
            <LogoFull size="lg" />
          </div>
          <p className="text-text-muted">
            Create your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-line rounded-md bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={12}
              className="w-full px-3 py-2 border border-line rounded-md bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="••••••••••••"
            />
            <p className="mt-1 text-xs text-text-muted">
              Must be at least 12 characters with good complexity
            </p>

            {/* Password Strength Indicator */}
            {password.length > 0 && (
              <div className="mt-3">
                {/* Strength bar */}
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      passwordStrength ? getStrengthColor(passwordStrength.score) : 'bg-gray-300'
                    }`}
                    style={{
                      width: passwordStrength
                        ? `${(passwordStrength.score + 1) * 20}%`
                        : `${Math.min(password.length / 12 * 20, 20)}%`
                    }}
                  />
                </div>

                {/* Strength label */}
                {passwordStrength && (
                  <div className="mt-2">
                    <p className={`text-sm font-medium ${getStrengthTextColor(passwordStrength.score)}`}>
                      {passwordStrength.label}
                      {passwordStrength.crackTime && (
                        <span className="font-normal text-text-muted ml-2">
                          (crack time: {passwordStrength.crackTime})
                        </span>
                      )}
                    </p>

                    {/* Errors */}
                    {passwordStrength.errors?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {passwordStrength.errors.map((err, i) => (
                          <p key={i} className="text-sm text-loss flex items-center gap-1">
                            <X className="w-3 h-3 flex-shrink-0" />
                            <span>{err}</span>
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Warnings */}
                    {passwordStrength.warnings?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {passwordStrength.warnings.map((warn, i) => (
                          <p key={i} className="text-sm text-yellow-600 dark:text-yellow-500 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                            <span>{warn}</span>
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Suggestions */}
                    {passwordStrength.suggestions?.length > 0 && passwordStrength.score < 3 && (
                      <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm text-blue-700 dark:text-blue-300">
                        <p className="font-medium mb-1">Suggestions:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          {passwordStrength.suggestions.map((sug, i) => (
                            <li key={i}>{sug}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {checkingStrength && !passwordStrength && (
                  <p className="text-xs text-text-muted mt-1">Checking password strength...</p>
                )}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-secondary mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={12}
              className="w-full px-3 py-2 border border-line rounded-md bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="••••••••••••"
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="mt-1 text-xs text-loss">Passwords do not match</p>
            )}
          </div>

          {displayError && (
            <div className="p-3 bg-loss/10 border border-loss text-loss rounded-md text-sm">
              {displayError}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-2 px-4 bg-brand text-white font-medium rounded-md hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>

          {/* Strength requirement hint when button is disabled */}
          {password.length >= 12 && !isPasswordStrong && !isLoading && (
            <p className="text-xs text-center text-text-muted">
              Password must be rated "Strong" or better to continue
            </p>
          )}
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-text-muted">
            Already have an account?{' '}
            <Link to="/login" className="text-brand font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
