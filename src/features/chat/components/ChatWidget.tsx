import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Minus, ChevronsLeftRight } from 'lucide-react';
import { Button, Text } from '@shared/components';
import Progress from '@shared/components/ui/Progress';
import { MessageGroup } from './core/MessageGroup';
import { ChatInput } from './core/ChatInput';
import { TypingIndicator } from './core/TypingIndicator';
import { useAdminChatDockWidth } from '@admin/hooks/useAdminChatDockWidth';
import type { ChatMessage, QuickReply } from '@features/chat/types';

export type ChatWidgetMode = 'panel' | 'dock' | 'overlay';

export interface ChatWidgetProps {
  mode: ChatWidgetMode;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  userRole: 'customer' | 'admin' | 'guest';

  // optional
  title?: string;
  isTyping?: boolean;
  readOnly?: boolean;
  quickReplies?: QuickReply[];
  onQuickReply?: (value: string | { value: string; label: string }) => void;
  onClose?: () => void;
  onMinimize?: () => void;
  onAttachFiles?: (files: FileList) => void;
  uploadProgressPct?: number | null;
  sessionId?: string;
  conversationId?: string;

  // dock-only: controls open/closed state from parent
  open?: boolean;
  onToggle?: () => void;
}

const RESIZE_HANDLE_WIDTH = 40;

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  mode,
  messages,
  onSend,
  userRole,
  title = 'Chat with Printy',
  isTyping,
  readOnly = false,
  quickReplies,
  onQuickReply,
  onClose,
  onMinimize,
  onAttachFiles,
  uploadProgressPct,
  sessionId,
  conversationId,
  open = true,
  onToggle,
}) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    width: dockWidth,
    minWidth,
    maxWidth,
    isResizing: isAdjustingWidth,
    handleMouseDown: handleResizeMouseDown,
    handleTouchStart: handleResizeTouchStart,
    handleKeyboardResize: handleResizeKeydown,
    resetWidth: resetDockWidth,
  } = useAdminChatDockWidth();

  // Sync dock width to CSS custom property so the admin layout can shrink accordingly
  useEffect(() => {
    if (mode !== 'dock') return;
    const root = document.documentElement;
    const widthValue = open ? `${dockWidth + RESIZE_HANDLE_WIDTH}px` : '0px';
    root.style.setProperty('--admin-chat-dock-width', widthValue);
    return () => {
      root.style.removeProperty('--admin-chat-dock-width');
    };
  }, [mode, dockWidth, open]);

  // Auto-scroll to bottom on new messages or typing
  useEffect(() => {
    if (scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current!.scrollTop = scrollRef.current!.scrollHeight;
      });
    }
  }, [messages, isTyping]);

  // Group messages by role for sequential animation
  const messageGroups = useMemo(() => {
    const groups: { messages: ChatMessage[]; quickReplies?: QuickReply[] }[] = [];
    let currentGroup: ChatMessage[] = [];
    let lastRole: ChatMessage['role'] | null = null;

    const sorted = [...messages].sort((a, b) => a.ts - b.ts);

    sorted.forEach((msg, index) => {
      const isLast = index === sorted.length - 1;
      const isBot = msg.role === 'printy';

      if (msg.role !== lastRole) {
        if (currentGroup.length > 0) groups.push({ messages: [...currentGroup] });
        currentGroup = [msg];
      } else {
        currentGroup.push(msg);
      }

      if (isLast) {
        groups.push({
          messages: [...currentGroup],
          quickReplies: isBot ? quickReplies : undefined,
        });
      }

      lastRole = msg.role;
    });

    return groups;
  }, [messages, quickReplies]);

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || readOnly) return;
    onSend(text);
    setInput('');
  };

  // --- Shared sub-sections ---

  const header = (
    <div className="p-4 border-b border-neutral-200 flex items-center justify-between shrink-0">
      <Text variant={mode === 'dock' ? 'h3' : 'h2'} size="lg" weight="semibold">
        {title}
      </Text>
      <div className="flex items-center gap-2">
        {onMinimize && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMinimize}
            className="h-9 w-9 p-0 text-neutral-500"
            aria-label="Minimize chat"
          >
            <Minus className="w-5 h-5" />
          </Button>
        )}
        {onToggle && mode === 'dock' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-8 w-8 p-0"
            aria-label="Minimize chat"
          >
            <Minus className="w-4 h-4" />
          </Button>
        )}
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-9 w-9 p-0"
            aria-label="Close chat"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </Button>
        )}
      </div>
    </div>
  );

  const messageList = (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 relative">
      {messageGroups.length === 0 && !isTyping && (
        <div className="flex items-center justify-center h-full text-neutral-400 text-sm select-none">
          Start the conversation below
        </div>
      )}
      {messageGroups.map((group, idx) => (
        <MessageGroup
          key={idx}
          messages={group.messages}
          quickReplies={group.quickReplies}
          onQuickReply={onQuickReply}
          onEndChat={onClose}
          readOnly={readOnly}
          isHistorical={group.messages.every(m => m.isHistorical === true)}
          userRole={userRole === 'guest' ? 'customer' : userRole}
          sessionId={sessionId}
          conversationId={conversationId}
        />
      ))}
      {isTyping && (
        <div className="flex justify-start">
          <TypingIndicator />
        </div>
      )}
    </div>
  );

  const footer = (
    <div className="border-t border-neutral-200 shrink-0">
      {readOnly ? (
        <div className="bg-neutral-50 p-3 text-center">
          <span className="text-sm text-neutral-500">
            This conversation has ended but you can view messages.
          </span>
        </div>
      ) : (
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Type a message..."
          showAttach={!!onAttachFiles}
          onAttachFiles={onAttachFiles}
          disabled={readOnly}
        />
      )}
    </div>
  );

  const uploadProgress = typeof uploadProgressPct === 'number' && (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm border border-neutral-200 rounded-full px-4 py-2 shadow-lg z-40 w-[min(420px,90vw)]">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-neutral-500">Uploading…</span>
        <span className="text-xs text-neutral-500">{uploadProgressPct}%</span>
      </div>
      <Progress value={uploadProgressPct} />
    </div>
  );

  // --- Mode-specific containers ---

  if (mode === 'dock') {
    if (!open) return null;

    return (
      <div className="hidden lg:flex fixed right-0 top-0 bottom-0 z-30 animate-in slide-in-from-right duration-300">
        {/* Resize handle */}
        <div className="h-full w-10 border-l border-neutral-200 bg-white flex items-center justify-center shadow-sm">
          <button
            type="button"
            role="slider"
            aria-label="Resize chat panel"
            aria-orientation="horizontal"
            aria-valuemin={minWidth}
            aria-valuemax={maxWidth}
            aria-valuenow={dockWidth}
            title="Drag to resize chat panel"
            tabIndex={0}
            className={`w-7 h-20 rounded-full flex flex-col items-center justify-center gap-1 text-neutral-400 cursor-col-resize focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500 transition-colors ${
              isAdjustingWidth ? 'bg-neutral-100' : 'bg-white'
            }`}
            onMouseDown={handleResizeMouseDown}
            onTouchStart={handleResizeTouchStart}
            onKeyDown={handleResizeKeydown}
            onDoubleClick={resetDockWidth}
          >
            <span className="flex flex-col items-center justify-center gap-1">
              <span className="w-[1px] h-6 rounded-full bg-neutral-300" aria-hidden="true" />
              <ChevronsLeftRight className="w-4 h-4" aria-hidden="true" />
              <span className="w-[1px] h-6 rounded-full bg-neutral-300" aria-hidden="true" />
            </span>
          </button>
        </div>

        <aside
          className="flex flex-col h-full bg-white border-l border-neutral-200 overflow-hidden"
          style={{ width: dockWidth }}
          data-admin-chat-open="true"
        >
          {header}
          {messageList}
          {footer}
          {typeof uploadProgressPct === 'number' && (
            <div className="absolute bottom-3 left-4 right-4 bg-white/90 backdrop-blur-sm border border-neutral-200 rounded-xl px-4 py-2 shadow-lg">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-neutral-500">Uploading…</span>
                <span className="text-xs text-neutral-500">{uploadProgressPct}%</span>
              </div>
              <Progress value={uploadProgressPct} />
            </div>
          )}
        </aside>
      </div>
    );
  }

  if (mode === 'overlay') {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-white animate-in slide-in-from-bottom duration-300">
        {header}
        {messageList}
        {footer}
        {uploadProgress}
      </div>
    );
  }

  // mode === 'panel' (default)
  return (
    <div className="h-full flex flex-col bg-white animate-in fade-in duration-300" data-chat-active="true">
      {header}
      {messageList}
      {footer}
      {uploadProgress}
    </div>
  );
};

export default ChatWidget;
