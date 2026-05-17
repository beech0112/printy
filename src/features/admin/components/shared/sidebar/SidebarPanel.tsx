import React from 'react';
import { MessageSquare, Settings, LogOut, Bot } from 'lucide-react';
import { Button, Tooltip } from '@admin/components/shared';
import Notification from '@shared/components/feedback/Notification';

export interface SidebarPanelProps {
  onOpenChat?: () => void;
  onViewAllChats?: () => void;
  onSettings: () => void;
  onLogout: () => void;
}

/**
 * Admin sidebar panel - Simple icon-based navigation (Claude-style)
 * Shows Printy logo at top, 3 icon buttons at bottom: Chats, Settings, Logout
 * Uses tooltips on hover to show labels
 */
export const SidebarPanel: React.FC<SidebarPanelProps> = ({
  onOpenChat,
  onViewAllChats,
  onSettings,
  onLogout,
}) => {
  return (
    <div
      className="h-full flex flex-col bg-white border-r border-neutral-200 sticky top-0"
      style={{ zIndex: 99998 }}
    >
      {/* Top Group: Printy Logo + Chats Button */}
      <div className="flex flex-col items-center gap-2 shrink-0 p-2 pt-4 z-10">
        {/* Printy Logo / Open Chat */}
        <Tooltip label="Ask Printy" position="right">
          <button
            type="button"
            onClick={onOpenChat}
            className="w-10 h-10 rounded-lg bg-brand-primary text-white flex items-center justify-center mb-2 hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-primary"
            aria-label="Open Printy chat"
          >
            <Bot className="w-6 h-6" />
          </button>
        </Tooltip>

        {/* Notification Bell */}
        <Notification inline />

        {/* Chats Button */}
        {onViewAllChats && (
          <Tooltip label="Chats" position="right">
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewAllChats}
              className="w-10 h-10 p-0 flex items-center justify-center hover:bg-neutral-100 rounded-lg transition-colors"
              aria-label="View all chats"
            >
              <MessageSquare className="w-5 h-5 text-neutral-700" />
            </Button>
          </Tooltip>
        )}
      </div>

      {/* Spacer to push bottom buttons down */}
      <div className="flex-1" />

      {/* Bottom Group: Settings + Logout */}
      <div className="flex flex-col items-center gap-2 p-2 pb-4 z-10">
        <Tooltip label="Settings" position="right">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSettings}
            className="w-10 h-10 p-0 flex items-center justify-center hover:bg-neutral-100 rounded-lg transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5 text-neutral-700" />
          </Button>
        </Tooltip>

        <Tooltip label="Logout" position="right">
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="w-10 h-10 p-0 flex items-center justify-center hover:bg-neutral-100 rounded-lg transition-colors"
            aria-label="Logout"
          >
            <LogOut className="w-5 h-5 text-neutral-700" />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
};

export default SidebarPanel;
