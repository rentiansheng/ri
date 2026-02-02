import React from 'react';
import './FlowView.css';

const FlowView: React.FC = () => {
  return (
    <div className="flow-view">
      <div className="flow-header">
        <h3>FLOW</h3>
      </div>
      
      <div className="flow-content">
        <div className="flow-placeholder">
          <div className="flow-icon">🔄</div>
          <h4>Workflow Management</h4>
          <p>Create and manage automated workflows</p>
          <p className="flow-hint">Coming soon...</p>
        </div>
      </div>
    </div>
  );
};

export default FlowView;
