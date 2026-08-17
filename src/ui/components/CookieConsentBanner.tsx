import React from 'react';
import { Cookie, Check, X } from 'lucide-react';

interface CookieConsentBannerProps {
  onAccept: () => void;
  onDecline: () => void;
}

export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({
  onAccept,
  onDecline,
}) => {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-xl bg-moss-900/95 border border-emerald-500/50 backdrop-blur-md rounded-xl shadow-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-emerald-700/20 text-emerald-400 border border-emerald-600/30 shrink-0">
          <Cookie className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-semibold text-sand-100 mb-0.5">
            Remember Your Settings?
          </h4>
          <p className="text-[11px] text-sand-300 leading-relaxed">
            Cut Up is 100% private, client-side, and ad-free. Would you like us to save your display preferences and tool defaults in your browser between visits?
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        <button
          onClick={onDecline}
          className="btn btn-sm btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 text-sand-300"
          title="Do not save settings between sessions"
        >
          <X className="w-3.5 h-3.5" /> Decline
        </button>
        <button
          onClick={onAccept}
          className="btn btn-sm btn-primary text-xs px-3.5 py-1.5 flex items-center gap-1 shadow-md shadow-emerald-950/40"
          title="Save settings in browser local storage"
        >
          <Check className="w-3.5 h-3.5" /> Accept & Remember
        </button>
      </div>
    </div>
  );
};
