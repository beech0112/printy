import { supabase } from '@lib/supabase';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ChatWidget } from '@features/chat/components/ChatWidget';
import { useChatPipeline } from '@features/chat/hooks/shared/useChatPipeline';
import SidebarPanel from '@customer/components/shared/sidebar/SidebarPanel';
import LogoutButton from '@customer/components/shared/sidebar/LogoutButton';
import LogoutModal from '@customer/components/shared/sidebar/LogoutModal';
import MobileSidebarMenu from '@customer/components/shared/sidebar/MobileSidebarMenu';
import MobileSidebarTrigger from '@customer/components/shared/sidebar/MobileSidebarTrigger';
import DashboardGrid from '@customer/components/dashboard/DashboardGrid';
import ChatCards from '@customer/components/dashboard/chatCards/ChatCards';
import RecentCard from '@customer/components/dashboard/RecentCard';
import { ToastContainer, Text } from '@shared/components';
import Notification from '@shared/components/feedback/Notification';
import { CustomerDashboardLoading } from '@customer/components/loadingStates';
import { useLogoutWithToast } from '@auth/hooks/useLogoutWithToast';
import { useRecentOrder } from '@customer/hooks/useRecentOrder';
import { useRecentTicket } from '@customer/hooks/useRecentTicket';
import { useRecentQuote } from '@customer/hooks/useRecentQuote';
import { useDeviceUtils } from '@shared/hooks/ui';
import { useCustomerConversationsContext } from '@features/chat/hooks/customer/CustomerConversationsProvider';

const TOPIC_MESSAGES: Record<string, string> = {
  servicesOffered: 'What services do you offer?',
  askQuote: 'I want to request a quote.',
  placeOrder: 'I want to place an order.',
  issueTicket: 'I need help with an issue.',
  aboutUs: 'Tell me about B.J. Santiago.',
  faqs: 'What are your most frequently asked questions?',
};

const CustomerDashboardContent: React.FC = () => {
  const navigate = useNavigate();
  const { logout, toasts, toast } = useLogoutWithToast();
  const { isMobileOrTablet } = useDeviceUtils();
  const { conversations } = useCustomerConversationsContext();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [userId, setUserId] = useState<string | undefined>();
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [customerType, setCustomerType] = useState<'regular' | 'valued'>('regular');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      setCustomerId(user.id);
      supabase
        .from('profiles')
        .select('customer_type')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.customer_type === 'valued') setCustomerType('valued');
        });
    });
  }, []);

  const { messages, isTyping, send, greet, reset, quickReplies } = useChatPipeline({
    userRole: 'customer',
    customerType,
    userId,
  });

  // Greet on mount (desktop panel always open)
  useEffect(() => {
    if (!isMobileOrTablet) {
      greet();
    }
  }, [isMobileOrTablet]);

  const { data: recentOrder, loading: loadingRecentOrder } = useRecentOrder();
  const { data: recentTicket, loading: loadingRecentTicket } = useRecentTicket();
  const { data: recentQuote, loading: loadingRecentQuote } = useRecentQuote(customerId);

  const isLoading = loadingRecentOrder || loadingRecentTicket || loadingRecentQuote;
  const hasRecentActivity = Boolean(recentOrder || recentTicket || recentQuote);

  useEffect(() => {
    if (sessionStorage.getItem('signin-success') === 'true') {
      sessionStorage.removeItem('signin-success');
      toast.success('Welcome back!', 'Successfully signed in');
    }
  }, [toast]);

  const openMobileChat = useCallback((topic?: string) => {
    reset();
    setIsMobileChatOpen(true);
    window.dispatchEvent(new CustomEvent('customer-chat-opened'));
    if (topic && TOPIC_MESSAGES[topic]) {
      setTimeout(() => send(TOPIC_MESSAGES[topic]), 0);
    } else {
      setTimeout(() => greet(), 0);
    }
  }, [reset, greet, send]);

  const sendTopic = useCallback((topic: string) => {
    if (isMobileOrTablet) {
      openMobileChat(topic);
    } else {
      if (TOPIC_MESSAGES[topic]) send(TOPIC_MESSAGES[topic]);
    }
  }, [isMobileOrTablet, openMobileChat, send]);

  const closeMobileChat = useCallback(() => {
    setIsMobileChatOpen(false);
    window.dispatchEvent(new CustomEvent('customer-chat-closed'));
  }, []);

  const handleLogout = () => setShowLogoutModal(true);
  const confirmLogout = async () => {
    setShowLogoutModal(false);
    await logout('/auth/signin');
  };

  const handleSwitchConversation = (id: string) => {
    setIsMobileSidebarOpen(false);
    window.dispatchEvent(new CustomEvent('customer-open-session', { detail: { sessionId: id } }));
  };

  const handleNavigateToAccount = () => {
    setIsMobileSidebarOpen(false);
    navigate('/customer/account');
  };

  // ── Mobile: full-page chat takeover ───────────────────────────────────────
  if (isMobileOrTablet && isMobileChatOpen) {
    return (
      <div className="h-screen bg-gradient-to-br from-neutral-50 to-brand-primary-50 flex flex-col">
        <ChatWidget
          mode="overlay"
          messages={messages}
          onSend={send}
          userRole="customer"
          title="Chat with Printy"
          isTyping={isTyping}
          quickReplies={quickReplies}
          onQuickReply={r => send(typeof r === 'string' ? r : r.label)}
          onClose={closeMobileChat}
          onMinimize={closeMobileChat}
          open={true}
        />
        <ToastContainer
          toasts={toasts}
          onRemoveToast={id => toast.remove(id)}
          position="top-center"
        />
        <LogoutModal
          isOpen={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          onConfirm={confirmLogout}
        />
      </div>
    );
  }

  // ── Desktop: split layout ─────────────────────────────────────────────────
  const dashboardContent = isLoading ? (
    <CustomerDashboardLoading />
  ) : (
    <div className="w-full">
      <div className="text-center space-y-1 mb-6">
        <Text variant="h1" className="device-text-heading text-brand-primary" size="xl" weight="extrabold">
          How can I help you today?
        </Text>
        <Text variant="p" className="device-text-body text-neutral-600">
          Check recent activity or start a new chat
        </Text>
      </div>
      <DashboardGrid
        recentCard={
          hasRecentActivity ? (
            <RecentCard
              orderData={recentOrder}
              ticketData={recentTicket}
              quoteData={recentQuote}
              onTopicSelect={sendTopic}
            />
          ) : undefined
        }
        chatCards={<ChatCards onSelect={sendTopic} />}
      />
    </div>
  );

  return (
    <div className="h-screen bg-gradient-to-br from-neutral-50 to-brand-primary-50 flex overflow-hidden">

      {/* ── Desktop collapsible sidebar ── */}
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-neutral-200 transition-all duration-200 relative shrink-0 ${
          isSidebarCollapsed ? 'w-0 overflow-hidden border-r-0' : 'w-64 xl:w-72'
        }`}
      >
        <SidebarPanel
          conversations={conversations}
          activeId={null}
          onSwitchConversation={handleSwitchConversation}
          onNavigateToAccount={handleNavigateToAccount}
          bottomActions={<LogoutButton onClick={handleLogout} />}
        />
      </aside>

      {/* Sidebar collapse toggle */}
      <button
        type="button"
        onClick={() => setIsSidebarCollapsed(c => !c)}
        className="hidden lg:flex items-center justify-center w-5 shrink-0 bg-white border-r border-neutral-200 hover:bg-neutral-50 transition-colors z-10"
        aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isSidebarCollapsed
          ? <ChevronRight className="w-3 h-3 text-neutral-400" />
          : <ChevronLeft className="w-3 h-3 text-neutral-400" />
        }
      </button>

      {/* ── Mobile sidebar overlay ── */}
      {isMobileSidebarOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/20 z-40"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <aside className="lg:hidden fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl z-50">
            <MobileSidebarMenu
              conversations={conversations}
              activeId={null}
              onClose={() => setIsMobileSidebarOpen(false)}
              onSwitchConversation={handleSwitchConversation}
              onAccount={handleNavigateToAccount}
              onLogout={handleLogout}
            />
          </aside>
        </>
      )}

      {/* ── Left column: main content ── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-neutral-200 px-4 py-3 flex items-center gap-4">
          <MobileSidebarTrigger onOpen={() => setIsMobileSidebarOpen(true)} />
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8 mx-auto w-full max-w-2xl">
            <Notification />
            {dashboardContent}
          </div>
        </div>
      </main>

      {/* ── Right column: persistent chat panel (desktop only) ── */}
      <aside className="hidden lg:flex flex-col w-[400px] xl:w-[440px] shrink-0 border-l border-neutral-200 bg-white">
        <ChatWidget
          mode="panel"
          messages={messages}
          onSend={send}
          userRole="customer"
          title="Chat with Printy"
          isTyping={isTyping}
          quickReplies={quickReplies}
          onQuickReply={r => send(typeof r === 'string' ? r : r.label)}
          open={true}
        />
      </aside>

      <ToastContainer
        toasts={toasts}
        onRemoveToast={id => toast.remove(id)}
        position={isMobileOrTablet ? 'top-center' : 'bottom-right'}
      />
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
      />
    </div>
  );
};

const CustomerDashboard: React.FC = () => <CustomerDashboardContent />;
export default CustomerDashboard;
