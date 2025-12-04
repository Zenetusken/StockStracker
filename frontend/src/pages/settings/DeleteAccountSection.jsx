import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../../components/toast/ToastContext';
import {
  Trash2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

function DeleteAccountSection() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const toast = useToast();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteForm, setDeleteForm] = useState({
    password: '',
    confirmation: '',
  });
  const [deleting, setDeleting] = useState(false);

  // Delete account
  const handleDeleteAccount = async (e) => {
    e.preventDefault();

    if (deleteForm.confirmation !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    setDeleting(true);
    try {
      await api.delete('/settings/account', {
        data: {
          password: deleteForm.password,
          confirmation: deleteForm.confirmation,
        },
      });
      toast.success('Account deleted successfully');
      logout();
      navigate('/login');
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to delete account';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="bg-card rounded-lg shadow p-6 border border-loss/20" data-testid="settings-danger-zone">
        <h3 className="text-lg font-semibold text-loss flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5" />
          Danger Zone
        </h3>

        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-text-primary">Delete Account</div>
            <div className="text-sm text-text-muted">
              Permanently delete your account and all associated data
            </div>
          </div>
          <button
            onClick={() => setShowDeleteModal(true)}
            data-testid="settings-delete-account-button"
            className="flex items-center gap-2 px-4 py-2 bg-loss text-white rounded-lg hover:bg-loss/90"
          >
            <Trash2 className="w-4 h-4" />
            Delete Account
          </button>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full mx-4 p-6" data-testid="delete-account-modal">
            <h3 className="text-xl font-bold text-loss flex items-center gap-2 mb-4">
              <AlertTriangle className="w-6 h-6" />
              Delete Account
            </h3>

            <p className="text-text-muted mb-4">
              This action is <strong>permanent</strong> and cannot be undone.
              All your data including watchlists, portfolios, and transactions will be deleted.
            </p>

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Enter your password
                </label>
                <input
                  type="password"
                  value={deleteForm.password}
                  onChange={(e) => setDeleteForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 bg-page-bg border border-border rounded-lg text-text-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Type <span className="font-mono text-loss">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteForm.confirmation}
                  onChange={(e) => setDeleteForm(f => ({ ...f, confirmation: e.target.value }))}
                  className="w-full px-3 py-2 bg-page-bg border border-border rounded-lg text-text-primary"
                  placeholder="DELETE"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteForm({ password: '', confirmation: '' });
                  }}
                  className="flex-1 px-4 py-2 bg-page-bg text-text-primary border border-border rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleting || deleteForm.confirmation !== 'DELETE'}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-loss text-white rounded-lg hover:bg-loss/90 disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete Forever
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default DeleteAccountSection;
