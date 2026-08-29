import React, { useEffect } from 'react';
import { X, Sliders, Layers, Sparkles, Grid, Cookie, Check, RotateCcw } from 'lucide-react';
import { UserPreferences, DEFAULT_USER_PREFERENCES } from '../../state/preferences';

interface PreferencesModalProps {
  isOpen: boolean;
  preferences: UserPreferences;
  onUpdatePreferences: (updater: (prev: UserPreferences) => UserPreferences) => void;
  onClose: () => void;
}

const SHADOW_COLOR_PRESETS = [
  { name: 'Pure Black', color: '#000000' },
  { name: 'Charcoal', color: '#1e293b' },
  { name: 'Sepia', color: '#3c2415' },
  { name: 'Neon', color: '#ff2a85' },
  { name: 'Purple!', color: '#9333ea' },
];

const WORKBENCH_THEMES = [
  {
    id: 'drafting' as const,
    name: 'Drafting Pad',
    desc: 'Cream notebook dot grid',
    iconBg: '#ede7db',
    iconBorder: '#b8b09f',
  },
  {
    id: 'cutting_mat' as const,
    name: 'Cutting Mat',
    desc: 'Emerald workshop grid',
    iconBg: '#132a1c',
    iconBorder: '#2e7d4f',
  },
  {
    id: 'clean_gray' as const,
    name: 'Neutral Gray',
    desc: '18% photo gray vignette',
    iconBg: '#27272a',
    iconBorder: '#52525b',
  },
];

const PAPER_TEXTURES = [
  {
    id: 'off' as const,
    name: 'Off (Smooth)',
    desc: 'Crisp flat vector cardstock',
  },
  {
    id: 'smooth_bristol' as const,
    name: 'Hot-Press Bristol',
    desc: 'Fine tooth & satin paper grain',
  },
  {
    id: 'cold_press' as const,
    name: 'Cold-Press Rag',
    desc: 'Organic cotton dimpled relief',
  },
];

export const PreferencesModal: React.FC<PreferencesModalProps> = ({
  isOpen,
  preferences,
  onUpdatePreferences,
  onClose,
}) => {
  // Handle keyboard shortcuts (Escape to close)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleResetDefaults = () => {
    onUpdatePreferences(prev => ({
      ...DEFAULT_USER_PREFERENCES,
      enableCookiePersistence: prev.enableCookiePersistence,
      cookieConsentDismissed: prev.cookieConsentDismissed,
    }));
  };

  const currentTexture = preferences.paperTexture;
  const currentTextureStrength = currentTexture === 'smooth_bristol'
    ? (preferences.textureStrengths?.smooth_bristol ?? 0.10)
    : currentTexture === 'cold_press'
      ? (preferences.textureStrengths?.cold_press ?? 0.10)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl max-h-[90vh] bg-moss-900 border border-sand-700/90 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-sand-800/80 flex items-center justify-between bg-moss-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-700/20 text-emerald-400 border border-emerald-600/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-sand-100">
                Workspace Preferences & Display
              </h3>
              <p className="text-[11px] text-sand-400">
                Customize on-screen simulation, backdrops, and print style without altering raw SVG cut exports.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-sand-400 hover:text-sand-100 hover:bg-moss-800/80 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content Scrollable Area */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* SECTION 1: Workbench Backdrop Theme (Active) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-sand-300">
              <div className="flex items-center gap-2">
                <Grid className="w-4 h-4 text-emerald-400" />
                <span>Workbench Backdrop Theme</span>
              </div>
              <span className="text-[11px] text-emerald-400 font-mono font-normal">
                {WORKBENCH_THEMES.find(t => t.id === preferences.backdropTheme)?.name || 'Drafting Pad'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {WORKBENCH_THEMES.map((theme) => {
                const isSelected = preferences.backdropTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => onUpdatePreferences(prev => ({ ...prev, backdropTheme: theme.id }))}
                    className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all duration-150 relative ${
                      isSelected
                        ? 'bg-moss-800 border-emerald-500 ring-2 ring-emerald-500/50 shadow-md shadow-emerald-950/40'
                        : 'bg-moss-950/80 border-sand-800 hover:border-sand-700 hover:bg-moss-900'
                    }`}
                  >
                    {/* Theme Swatch Preview */}
                    <div
                      className="w-full h-8 rounded mb-2 border flex items-center justify-center overflow-hidden"
                      style={{
                        backgroundColor: theme.iconBg,
                        borderColor: theme.iconBorder,
                      }}
                    >
                      {theme.id === 'drafting' && (
                        <div className="w-full h-full drafting-paper-grid opacity-60" />
                      )}
                      {theme.id === 'cutting_mat' && (
                        <div className="w-full h-full workbench-theme-cutting_mat opacity-80" />
                      )}
                      {theme.id === 'clean_gray' && (
                        <div className="w-full h-full workbench-theme-clean_gray opacity-80" />
                      )}
                    </div>

                    <div>
                      <div className="font-semibold text-xs text-sand-100 flex items-center justify-between">
                        <span>{theme.name}</span>
                        {isSelected && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                      </div>
                      <div className="text-[10px] text-sand-400 leading-tight mt-0.5">
                        {theme.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: Tactile Paper Textures (Active) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-sand-300">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Tactile Paper Textures</span>
              </div>
              <span className="text-[11px] text-emerald-400 font-mono font-normal">
                {PAPER_TEXTURES.find(p => p.id === preferences.paperTexture)?.name || 'Off (Smooth)'}
              </span>
            </div>

            <div className="p-4 rounded-lg bg-moss-950/60 border border-sand-800/70 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {PAPER_TEXTURES.map((tex) => {
                  const isSelected = preferences.paperTexture === tex.id;
                  return (
                    <button
                      key={tex.id}
                      type="button"
                      onClick={() => onUpdatePreferences(prev => ({ ...prev, paperTexture: tex.id }))}
                      className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all duration-150 ${
                        isSelected
                          ? 'bg-moss-800 border-emerald-500 ring-2 ring-emerald-500/50 shadow-md shadow-emerald-950/40'
                          : 'bg-moss-900/90 border-sand-800 hover:border-sand-700 hover:bg-moss-850'
                      }`}
                    >
                      <div className="font-semibold text-xs text-sand-100 flex items-center justify-between">
                        <span>{tex.name}</span>
                        {isSelected && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                      </div>
                      <div className="text-[10px] text-sand-400 leading-tight mt-1">
                        {tex.desc}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Per-Texture Strength Slider */}
              {currentTexture !== 'off' && (
                <div className="space-y-1.5 pt-3 border-t border-sand-800/60 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-sand-200">
                    <span className="font-medium">
                      Texture Prominence ({currentTexture === 'smooth_bristol' ? 'Bristol' : 'Cold-Press'})
                    </span>
                    <span className="font-mono text-emerald-400">{Math.round(currentTextureStrength * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="1.0"
                    step="0.05"
                    value={currentTextureStrength}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onUpdatePreferences(prev => ({
                        ...prev,
                        textureStrengths: {
                          ...prev.textureStrengths,
                          [currentTexture]: val,
                        },
                      }));
                    }}
                    className="w-full h-1.5 bg-moss-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <p className="text-[10px] text-sand-500">
                    Adjusts the tactile depth and relief opacity. Settings persist independently for each paper type.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: 3D Composite Simulation & Direct-Print Depth */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sand-300">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>3D Stack Simulation & Print Depth</span>
            </div>

            <div className="p-4 rounded-lg bg-moss-950/60 border border-sand-800/70 space-y-4 text-xs">
              {/* Shadow Depth Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sand-200">
                  <span className="font-medium">Layer Drop Shadow Depth</span>
                  <span className="font-mono text-emerald-400">{preferences.layerShadowDepth}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="16"
                  step="1"
                  value={preferences.layerShadowDepth}
                  onChange={(e) => {
                    const layerShadowDepth = parseInt(e.target.value, 10);
                    onUpdatePreferences(prev => ({ ...prev, layerShadowDepth }));
                  }}
                  className="w-full h-1.5 bg-moss-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <p className="text-[10px] text-sand-500">
                  Simulates realistic paper cardstock depth and edge shadow in Composite View.
                </p>
              </div>

              {/* Shadow Opacity Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sand-200">
                  <span className="font-medium">Layer Shadow Darkness</span>
                  <span className="font-mono text-emerald-400">{Math.round(preferences.layerShadowOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.7"
                  step="0.05"
                  value={preferences.layerShadowOpacity}
                  onChange={(e) => {
                    const layerShadowOpacity = parseFloat(e.target.value);
                    onUpdatePreferences(prev => ({ ...prev, layerShadowOpacity }));
                  }}
                  className="w-full h-1.5 bg-moss-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              {/* Drop Shadow Color Picker */}
              <div className="space-y-2 pt-2 border-t border-sand-800/60">
                <div className="flex items-center justify-between text-sand-200">
                  <span className="font-medium">Drop Shadow Tint / Tone</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={preferences.layerShadowColor || '#000000'}
                      onChange={(e) => {
                        const layerShadowColor = e.target.value;
                        onUpdatePreferences(prev => ({ ...prev, layerShadowColor }));
                      }}
                      className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent shrink-0"
                      title="Custom shadow tint"
                    />
                    <span className="font-mono text-[11px] text-sand-400 uppercase">
                      {preferences.layerShadowColor || '#000000'}
                    </span>
                  </div>
                </div>

                {/* Color Presets */}
                <div className="flex items-center gap-1.5">
                  {SHADOW_COLOR_PRESETS.map((preset) => {
                    const isSelected = (preferences.layerShadowColor || '#000000').toLowerCase() === preset.color.toLowerCase();
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => onUpdatePreferences(prev => ({ ...prev, layerShadowColor: preset.color }))}
                        className={`px-2 py-1 rounded text-[10px] font-medium border flex items-center gap-1 transition ${
                          isSelected
                            ? 'bg-emerald-800/80 text-white border-emerald-500 shadow-sm'
                            : 'bg-moss-900 text-sand-400 border-sand-800 hover:text-sand-200'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-sand-600 shrink-0"
                          style={{ backgroundColor: preset.color }}
                        />
                        {preset.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Direct Print with Shadows Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-sand-800/60">
                <div>
                  <div className="font-medium text-sand-200">Include Shadows in Direct Browser Print</div>
                  <div className="text-[10px] text-sand-400">
                    Apply simulated 3D depth when printing from browser (useful for art prints; keep off for flat cuts).
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.printWithShadows}
                  onChange={(e) => {
                    const printWithShadows = e.target.checked;
                    onUpdatePreferences(prev => ({ ...prev, printWithShadows }));
                  }}
                  className="w-4 h-4 accent-emerald-600 cursor-pointer"
                />
              </div>

              {/* Direct Print with Margins Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-sand-800/60">
                <div>
                  <div className="font-medium text-sand-200">Include Paper Margin Border in Print</div>
                  <div className="text-[10px] text-sand-400">
                    Print full physical sheet with solid papercraft margin borders (turn off to crop print to image area).
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.printWithMargins !== false}
                  onChange={(e) => {
                    const printWithMargins = e.target.checked;
                    onUpdatePreferences(prev => ({ ...prev, printWithMargins }));
                  }}
                  className="w-4 h-4 accent-emerald-600 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: Storage & Session Persistence */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sand-300">
              <Cookie className="w-4 h-4 text-emerald-400" />
              <span>Storage & Session Persistence</span>
            </div>

            <div className="p-4 rounded-lg bg-moss-950/60 border border-sand-800/70 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sand-200">
                    Remember Settings Between Sessions
                  </div>
                  <div className="text-[10px] text-sand-400">
                    Save your sliders, units, and display options in browser storage. Disabling clears saved data.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.enableCookiePersistence}
                  onChange={(e) => {
                    const enableCookiePersistence = e.target.checked;
                    onUpdatePreferences(prev => ({
                      ...prev,
                      enableCookiePersistence,
                      cookieConsentDismissed: true,
                    }));
                  }}
                  className="w-4 h-4 accent-emerald-600 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-sand-800/80 bg-moss-950/60 flex items-center justify-between shrink-0 text-xs">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="btn btn-sm btn-secondary text-sand-300 hover:text-sand-100 flex items-center gap-1.5"
            title="Reset all visual settings to factory defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset to Defaults
          </button>

          <button
            onClick={onClose}
            className="btn btn-sm btn-primary px-4 py-1.5 flex items-center gap-1 shadow-md shadow-emerald-950/40"
          >
            <Check className="w-3.5 h-3.5" /> Done
          </button>
        </div>
      </div>
    </div>
  );
};
