import React from 'react';
import { HistoryContent } from './HistoryContent';
import './HistoryDetail.css';

interface HistoryDetailProps {
  sessionId: string | null;
  sessionName: string;
}

const HistoryDetail: React.FC<HistoryDetailProps> = ({ sessionId, sessionName }) => {
  if (!sessionId) {
    return (
      <div className="history-detail-empty">
        <div className="history-detail-placeholder">
          <div className="history-detail-icon">📜</div>
          <h3>Select a History Session</h3>
          <p>Choose a session from the left to view its command history</p>
        </div>
      </div>
    );
  }

  return (
    <div className="history-detail-view">
      <HistoryContent sessionId={sessionId} sessionName={sessionName} />
    </div>
  );
};

export default HistoryDetail;
