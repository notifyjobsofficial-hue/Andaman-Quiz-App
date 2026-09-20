import React from 'react';
import { NoticeManager } from '../components/notices/NoticeManager';

export const NoticeBoard: React.FC = () => {
  return (
    <div className="space-y-6">
      <NoticeManager
        embeddedTitle="Notice Board & Category Manager"
        embeddedSubtitle="Post, schedule, edit, pin, and categorize exam notices across all update types"
      />
    </div>
  );
};
