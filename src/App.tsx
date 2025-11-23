import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import SignUp from "./pages/SignUp";
import VerifyOTP from "./pages/VerifyOTP";
import VerifyLoginOTP from "./pages/VerifyLoginOTP";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Wishlist from "./pages/Wishlist";
import Account from "./pages/Account";
import Orders from "./pages/Orders";
import ProductDetail from "./pages/ProductDetail";
import NotFound from "./pages/NotFound";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentFailure from "./pages/PaymentFailure";
import OrderTracking from "./pages/OrderTracking";
import OfflineBooking from "./pages/OfflineBooking";
import OfflinePickup from "./pages/OfflinePickup";
import SellerOrderManagement from "./pages/SellerOrderManagement";
import ConfirmDelivery from "./pages/ConfirmDelivery";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { NotificationPreferences } from "./components/notifications/NotificationPreferences";
import { NotificationCenter } from "./components/notifications/NotificationCenter";
import { PendingFeedbackChecker } from "./components/feedback/PendingFeedbackChecker";
import SupportChat from "./pages/SupportChat";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      onError: (error) => {
        console.error('Query error:', error);
      },
    },
    mutations: {
      onError: (error) => {
        console.error('Mutation error:', error);
      },
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PendingFeedbackChecker />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/verify-otp" element={<VerifyOTP />} />
          <Route path="/verify-login-otp" element={<VerifyLoginOTP />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/account" element={<Account />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment-failure" element={<PaymentFailure />} />
          <Route path="/payment/failure" element={<PaymentFailure />} />
          <Route path="/order-tracking/:orderId" element={<OrderTracking />} />
          <Route path="/offline-booking" element={<OfflineBooking />} />
          <Route path="/offline-pickup" element={<OfflinePickup />} />
          <Route path="/seller-orders" element={<SellerOrderManagement />} />
          <Route path="/orders/confirm-delivery" element={<ConfirmDelivery />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/settings/notifications" element={<NotificationPreferences />} />
          <Route path="/notifications" element={<NotificationCenter />} />
          <Route path="/support-chat" element={<SupportChat />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
