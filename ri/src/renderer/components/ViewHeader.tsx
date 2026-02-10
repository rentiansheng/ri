import React from 'react';
import './ViewHeader.css';

export interface ViewHeaderProps {
  category: string;
  subcategory?: string;
  actions?: React.ReactNode;
}

export const ViewHeader: React.FC<ViewHeaderProps> = ({
  category,
  subcategory,
  actions,
}) => {
  return (
    <div className="view-header">
      <div className="view-header-title">
        <span className="view-header-category">[{category}]</span>
        {subcategory && (
          <>
            <span className="view-header-separator">:</span>
            <span className="view-header-subcategory">{subcategory}</span>
          </>
        )}
      </div>
      {actions && (
        <div className="view-header-actions">
          {actions}
        </div>
      )}
    </div>
  );
};
