// FAQ Data for Role-Based Chatbot

export type UserRole = "customer" | "retailer" | "wholesaler";

export interface FAQItem {
  question: string;
  answer: string;
}

export const FAQ_DATA: Record<UserRole, FAQItem[]> = {
  customer: [
    {
      question: "Where is my order?",
      answer: "You can track your order status in real-time from the 'My Orders' section. Click on any order to see detailed tracking information including current status, delivery address, and estimated delivery time. For more details, please call support at +91 1800-123-4567 or email help@livemart.com."
    },
    {
      question: "How to cancel my order?",
      answer: "You can cancel orders that are still in 'Pending' or 'Confirmed' status from the 'My Orders' page. Simply click on the order and select 'Cancel Order'. Once an order is being processed or shipped, it cannot be cancelled. For urgent cancellations, please call support at +91 1800-123-4567 or email help@livemart.com."
    },
    {
      question: "What is the return policy?",
      answer: "We offer a 7-day return policy for most products. Items must be unused, in original packaging, and with proof of purchase. Some items like perishables and personalized products are non-returnable. To initiate a return, go to 'My Orders' and select 'Return' option. For more details, please call support at +91 1800-123-4567 or email help@livemart.com."
    },
    {
      question: "How to track my delivery?",
      answer: "You can track your delivery from the 'My Orders' page. Click on any order to see real-time updates. You'll receive email notifications when your order status changes. For more details, please call support at +91 1800-123-4567 or email help@livemart.com."
    },
    {
      question: "What payment methods are accepted?",
      answer: "We accept Cash on Delivery (COD) and PayU online payments. You can choose your preferred payment method at checkout. For payment issues or refunds, please call support at +91 1800-123-4567 or email help@livemart.com."
    },
    {
      question: "How to update my delivery address?",
      answer: "You can manage multiple delivery addresses in your Account settings. Go to 'My Account' > 'Manage Addresses' to add, edit, or set a default address. You can also add a new address during checkout. For more details, please call support at +91 1800-123-4567 or email help@livemart.com."
    },
    {
      question: "What are the delivery charges?",
      answer: "Delivery charges vary based on your location and order value. Free delivery is available on orders above ₹500. Exact charges will be shown at checkout before you place your order. For more details, please call support at +91 1800-123-4567 or email help@livemart.com."
    },
    {
      question: "How long does delivery take?",
      answer: "Standard delivery takes 15-30 minutes for local orders. Delivery time may vary based on your location and product availability. You'll receive real-time updates via email and SMS. For more details, please call support at +91 1800-123-4567 or email help@livemart.com."
    }
  ],
  retailer: [
    {
      question: "How to add products to my inventory?",
      answer: "Go to your Dashboard > 'My Products' tab and click the 'Add Product' button. Fill in product details including name, description, price, stock quantity, and upload an image. Make sure your location is set for accurate delivery estimates. For more details, please call support at +91 1800-123-4567 or email help@livemart.com."
    },
    {
      question: "What is the settlement cycle?",
      answer: "Settlements are processed weekly. Payments are transferred to your registered bank account every Monday for orders delivered in the previous week. You can view your earnings and payment history in the Analytics section. For more details, please call support at +91 1800-123-4567 or email help@livemart.com."
    },
    {
      question: "How to contact wholesalers?",
      answer: "You can browse the Wholesaler Marketplace from your dashboard to find bulk suppliers. View product catalogs, compare prices, and place wholesale orders directly. Wholesaler contact information is available on their product listings. For more details, please call support at +91 1800-123-4567 or email help@livemart.com."
    },
    {
      question: "How to manage order status updates?",
      answer: "Navigate to 'Order Management' in your dashboard to view all customer orders. Click on any order to update its status (Confirmed, Processing, Shipped, Delivered). Customers will automatically receive email notifications when status changes. For more details, please call support at +91 1800-123-4567 or email help@livemart.com."
    },
    {
      question: "What are the commission rates?",
      answer: "Commission rates vary by product category and order value. Standard commission is 10-15% of the order value. Detailed commission breakdown is available in your Analytics dashboard. For more details, please call support at +91 1800-123-4567 or email help@livemart.com."
    },
    {
      question: "How to update my shop location?",
      answer: "Go to 'My Account' > 'Profile Information' and update your location using the map picker or by entering coordinates. Accurate location helps customers find your products. For more details, please call support at +91 1800-123-4567 or email help@livemart.com."
    },
    {
      question: "How to handle out-of-stock products?",
      answer: "Update product stock quantities in 'My Products'. Products with zero stock will show as 'Out of Stock' and won't be orderable. You'll receive alerts when products run low. Consider restocking or removing unavailable products. For more details, please call support at +91 1800-123-4567 or email help@livemart.com."
    },
    {
      question: "How to view customer feedback?",
      answer: "Customer reviews and ratings are available in your Dashboard under 'Feedback & Reviews'. You can reply to reviews and address customer concerns directly. Use this feedback to improve your products and service. For more details, please call support at +91 1800-123-4567 or email help@livemart.com."
    }
  ],
  wholesaler: [
    {
      question: "How does bulk verification work?",
      answer: "Bulk verification allows retailers to order products in large quantities. Orders above certain thresholds require approval. You'll receive notifications for bulk orders and can approve or modify them from the Order Management section. For more details, please call support at +91 1800-123-4567 or email help@livemart.com."
    },
    {
      question: "What are the commission rates for wholesalers?",
      answer: "Wholesaler commission rates are typically 5-8% of the order value. Rates may vary based on volume and product category. Detailed commission information is available in your Analytics dashboard. For more details, please call support at +91 1800-123-4567 or email help@livemart.com."
    },
    {
      question: "Which shipping partners are integrated?",
      answer: "We support multiple shipping partners for reliable delivery. You can view available partners in your account settings and select your preferred options. Shipping labels are generated automatically when orders are confirmed. For more details, please call support at +91 1800-123-4567 or email help@livemart.com."
    },
    {
      question: "How to manage retailer orders?",
      answer: "All retailer orders appear in your Dashboard > 'Order Flow' section. You can view order details, update status, and manage inventory. Use the status dropdown to mark orders as confirmed, processing, shipped, or delivered. For more details, please call support at +91 1800-123-4567 or email help@livemart.com."
    },
    {
      question: "How to set up inventory alerts?",
      answer: "Low stock alerts are automatically displayed on your dashboard when products reach zero quantity. You can configure minimum stock thresholds in your product settings. Regular monitoring helps maintain inventory levels. For more details, please call support at +91 1800-123-4567 or email help@livemart.com."
    },
    {
      question: "How to view performance analytics?",
      answer: "Navigate to 'Analytics' tab in your dashboard for comprehensive performance metrics. View sales trends, top-performing SKUs, retailer insights, and complaint logs. Export reports for detailed analysis. For more details, please call support at +91 1800-123-4567 or email help@livemart.com."
    },
    {
      question: "What payment terms are available?",
      answer: "Retailers can place orders with payment options including credit terms for bulk orders. Settlement cycles are weekly, and payments are processed every Monday. Payment history is available in your dashboard. For more details, please call support at +91 1800-123-4567 or email help@livemart.com."
    },
    {
      question: "How to handle product complaints?",
      answer: "Product complaints are tracked in the 'Alerts' section. Review complaint logs, analyze patterns, and take corrective action. You can respond to retailers and update product quality based on feedback. For more details, please call support at +91 1800-123-4567 or email help@livemart.com."
    }
  ]
};

