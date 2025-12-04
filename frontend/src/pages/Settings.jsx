import Layout from '../components/Layout';
import { Settings as SettingsIcon } from 'lucide-react';
import PreferencesSection from './settings/PreferencesSection';
import PasswordSection from './settings/PasswordSection';
import MFASection from './settings/MFASection';
import DataManagementSection from './settings/DataManagementSection';
import DeleteAccountSection from './settings/DeleteAccountSection';

/**
 * Settings Page
 * #123: Notification preferences toggle
 * #124: Change password
 * #125: Export all data as JSON
 * #126: Import data from JSON
 * #127: Delete account with confirmation
 */
function Settings() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="settings-page">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-text-primary flex items-center gap-3">
            <SettingsIcon className="w-8 h-8" />
            Settings
          </h2>
          <p className="text-text-muted mt-2">
            Manage your account preferences and data
          </p>
        </div>

        <PreferencesSection />
        <PasswordSection />
        <MFASection />
        <DataManagementSection />
        <DeleteAccountSection />
      </div>
    </Layout>
  );
}

export default Settings;
