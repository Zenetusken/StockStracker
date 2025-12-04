import { useState, useRef } from 'react';
import api from '../../api/client';
import { useToast } from '../../components/toast/ToastContext';
import {
  Download,
  Upload,
  Loader2,
} from 'lucide-react';

function DataManagementSection() {
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  // Export data
  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await api.get('/settings/export');
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stocktracker-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully');
    } catch {
      toast.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  // Import data
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      await api.post('/settings/import', {
        data,
        options: {
          watchlists: true,
          portfolios: true,
          alerts: true,
          preferences: true,
          mergeMode: 'merge',
        },
      });

      toast.success('Data imported successfully');
    } catch (err) {
      if (err instanceof SyntaxError) {
        toast.error('Invalid JSON file');
      } else {
        toast.error('Failed to import data');
      }
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="bg-card rounded-lg shadow p-6 mb-6" data-testid="settings-data-management">
      <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-4">
        <Download className="w-5 h-5" />
        Data Management
      </h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-text-primary">Export Data</div>
            <div className="text-sm text-text-muted">
              Download all your data as a JSON backup file
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            data-testid="settings-export-button"
            className="flex items-center gap-2 px-4 py-2 bg-page-bg text-text-primary border border-border rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export
          </button>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div>
            <div className="font-medium text-text-primary">Import Data</div>
            <div className="text-sm text-text-muted">
              Restore data from a JSON backup file
            </div>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
              id="import-file"
            />
            <label
              htmlFor="import-file"
              data-testid="settings-import-button"
              className={`flex items-center gap-2 px-4 py-2 bg-page-bg text-text-primary border border-border rounded-lg cursor-pointer hover:bg-gray-100 ${
                importing ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Import
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataManagementSection;
