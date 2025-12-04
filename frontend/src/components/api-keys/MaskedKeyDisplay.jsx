import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

/**
 * MaskedKeyDisplay - Displays masked API keys with copy functionality
 * L4 Security Fix: Removed reveal button to prevent visual exposure of keys
 * Users can still copy the full value to clipboard without visual reveal
 */
export default function MaskedKeyDisplay({ maskedValue, fullValue, className = '' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (fullValue) {
      try {
        await navigator.clipboard.writeText(fullValue);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <code className="flex-1 px-2 py-1 bg-table-header dark:!bg-white/5 rounded text-sm font-mono truncate text-text-primary">
        {maskedValue}
      </code>

      {fullValue && (
        <button
          onClick={handleCopy}
          className="p-1.5 rounded hover:bg-card-hover dark:hover:bg-gray-700 transition-colors"
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="w-4 h-4 text-gain" />
          ) : (
            <Copy className="w-4 h-4 text-text-muted" />
          )}
        </button>
      )}
    </div>
  );
}
