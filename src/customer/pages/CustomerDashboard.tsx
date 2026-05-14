import { supabase } from '@lib/supabase';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatWidget } from '@features/chat/components/ChatWidget';
import { useChatPipeline } from '@features/chat/hooks/shared/useChatPipeline';
import ResponsivePageLayout from '@customer/components/shared/layouts/ResponsivePageLayout';
import SidebarPanel from '@customer/components/shared/sidebar/SidebarPanel';
import LogoutButton from '@customer/components/shared/sidebar/LogoutButton';
import LogoutModal from '@customer/components/shared/sidebar/LogoutModal';
import DashboardGrid from '@customer/components/dashboard/DashboardGrid';
import ChatCards from '@customer/components/dashboard/chatCards/ChatCards';
import RecentCard from '@customer/components/dashboard/RecentCard';
import { ToastContainer, Text } from '@shared/components';
import Progress from '@shared/components/ui/Progress';
import Notification from '@shared/components/feedback/Notification';
import { CustomerDashboardLoading } from '@customer/components/loadingStates';
import { useLogoutWithToast } from '@/auth/hooks/useLogoutWithToast';
import { useRecentOrder } from '@customer/hooks/useRecentOrder';
import { useRecentTicket } from '@customer/hooks/useRecentTicket';
import { useRecentQuote } from '@customer/hooks/useRecentQuote';
import { useDeviceUtils } from '@shared/hooks/ui';

// ─── Inner Component ──────────────────────────────────────────────────────────

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
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [userId, setUserId] = useState<string | undefined>();
  const [customerType, setCustomerType] = useState<'regular' | 'valued'>('regular');

  // Resolve current user + customer type once
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
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

  // AI chat pipeline
  const { messages, isTyping, send, greet, reset } = useChatPipeline({
    userRole: 'customer',
    customerType,
    userId,
  });

  // Recent activity
  const { data: recentOrder, loading: loadingRecentOrder } = useRecentOrder();
  const { data: recentTicket, loading: loadingRecentTicket } = useRecentTicket();
  const [customerId, setCustomerId] = useState<string | undefined>();
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCustomerId(user?.id));
  }, []);
  const { data: recentQuote, loading: loadingRecentQuote } = useRecentQuote(customerId);

  const isLoading = loadingRecentOrder || loadingRecentTicket || loadingRecentQuote;

  const hasRecentActivity = Boolean(recentOrder || recentTicket || recentQuote);

  // Signin success toast
  useEffect(() => {
    if (sessionStorage.getItem('signin-success') === 'true') {
      sessionStorage.removeItem('signin-success');
      toast.success('Welcome back!', 'Successfully signed in');
    }
  }, [toast]);

  const openChat = useCallback((topic?: string) => {
    reset();
    setIsChatOpen(true);
    window.dispatchEvent(new CustomEvent('customer-chat-opened'));
    if (topic && TOPIC_MESSAGES[topic]) {
      setTimeout(() => send(TOPIC_MESSAGES[topic]), 0);
    } else {
      setTimeout(() => greet(), 0);
    }
  }, [reset, greet, send]);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
    window.dispatchEvent(new CustomEvent('customer-chat-closed'));
  }, []);

  const handleLogout = () => setShowLogoutModal(true);
  const confirmLogout = async () => {
    setShowLogoutModal(false);
    await logout('/auth/signin');
  };

  // Sidebar: minimal stub — no flow-based conversations list yet
  const sidebarConversations: any[] = [];

  // ─── Chat active layout ───────────────────────────────────────────────────

  if (isChatOpen) {
    return (
      <div className="h-screen bg-gradient-to-br from-neutral-50 to-brand-primary-50 flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 xl:w-80 bg-white border-r border-neutral-200 flex-col">
          <SidebarPanel
            conversations={sidebarConversations}
            activeId={null}
            onSwitchConversation={() => {}}
            onNavigateToAccount={() => navigate('/customer/account')}
            bottomActions={<LogoutButton onClick={handleLogout} />}
          />
        </aside>

        {/* Chat panel fills remaining space */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <ChatWidget
            mode={isMobileOrTablet ? 'overlay' : 'panel'}
            messages={messages}
            onSend={send}
            userRole="customer"
            title="Chat with Printy"
            isTyping={isTyping}
            onClose={closeChat}
            onMinimize={closeChat}
            open={true}
          />
        </main>

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
  }

  // ─── Dashboard view ───────────────────────────────────────────────────────

  const dashboardContent = (
    <>
      <Notification />
      {isLoading ? (
        <CustomerDashboardLoading />
      ) : (
        <div className="w-full">
          <div className="text-center space-y-1 mb-6 sm:mb-8">
            <Text
              variant="h1"
              className="device-text-heading text-brand-primary"
              size="xl"
              weight="extrabold"
            >
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
                  onTopicSelect={(key: string) => openChat(key)}
                />
              ) : undefined
            }
            chatCards={<ChatCards onSelect={(key) => openChat(key)} />}
          />
        </div>
      )}
    </>
  );

  return (
    <>
      <ResponsivePageLayout showSidebar={true}>{dashboardContent}</ResponsivePageLayout>

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
    </>
  );
};

// ─── Export ───────────────────────────────────────────────────────────────────

const CustomerDashboard: React.FC = () => <CustomerDashboardContent />;
export default CustomerDashboard;
