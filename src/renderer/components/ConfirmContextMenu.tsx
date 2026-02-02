import React, { useEffect, useRef } from 'react';
import './ConfirmContextMenu.css';

interface ConfirmContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmContextMenu: React.FC<ConfirmContextMenuProps> = ({
  isOpen,
  position,
  message,
  onConfirm,
  onCancel,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onCancel();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    // Add listeners after a small delay to avoid immediate closing
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 100);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onCancel]);

  if (!isOpen || !position) return null;

  // Adjust position to keep menu within viewport
  const adjustPosition = () => {
    if (!menuRef.current) return position;

    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let { x, y } = position;

    // Adjust horizontal position
    if (x + menuRect.width > viewportWidth) {
      x = viewportWidth - menuRect.width - 10;
    }

    // Adjust vertical position
    if (y + menuRect.height > viewportHeight) {
      y = viewportHeight - menuRect.height - 10;
    }

    return { x: Math.max(10, x), y: Math.max(10, y) };
  };

  const finalPosition = adjustPosition();

  return (
    <div
      ref={menuRef}
      className="confirm-context-menu"
      style={{
        left: `${finalPosition.x}px`,
        top: `${finalPosition.y}px`,
      }}
    >
      <div className="confirm-context-menu-message">
        {message}
      </div>
      <div className="confirm-context-menu-actions">
        <button
          className="confirm-context-menu-btn confirm-context-menu-btn-cancel"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="confirm-context-menu-btn confirm-context-menu-btn-confirm"
          onClick={onConfirm}
          autoFocus
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default ConfirmContextMenu;
