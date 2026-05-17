import React, { useEffect } from 'react';

const AdminDashboard: React.FC = () => {
  // Auto-open the chat dock when admin lands on the dashboard
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('admin-chat-open'));
  }, []);

  return null;
};

export default AdminDashboard;
