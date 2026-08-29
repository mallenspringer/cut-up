import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  badge,
  defaultOpen = true,
  isOpen: controlledIsOpen,
  onToggle,
  children,
  className = '',
  headerClassName = '',
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);
  const isExpanded = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalIsOpen(!internalIsOpen);
    }
  };

  return (
    <div className={`border-b border-sand-800/70 ${className}`}>
      <div
        className={`w-full px-4 py-3 flex items-center justify-between select-none ${headerClassName}`}
      >
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sand-300 hover:text-sand-100 transition-colors py-1 group text-left cursor-pointer"
        >
          {icon && <span className="text-emerald-400">{icon}</span>}
          <span>{title}</span>
          <div className="text-sand-400 group-hover:text-sand-200 transition-colors ml-1">
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </div>
        </button>

        {badge && <div className="ml-2 flex items-center">{badge}</div>}
      </div>

      {isExpanded && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </div>
  );
};
