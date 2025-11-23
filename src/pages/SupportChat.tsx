import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, MessageCircle, Bot } from "lucide-react";
import { FAQ_DATA, type UserRole } from "@/data/faqData";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const SupportChat = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<UserRole>("customer");
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<Array<{ type: "question" | "answer"; text: string }>>([]);

  useEffect(() => {
    fetchUserRole();
  }, []);

  const fetchUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (!error && data) {
        const role = data.role.toLowerCase() as UserRole;
        setUserRole(role);
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
    }
  };

  const handleQuestionClick = (faqItem: { question: string; answer: string }) => {
    setSelectedQuestion(faqItem.question);
    
    // Add to chat history
    setChatHistory((prev) => [
      ...prev,
      { type: "question", text: faqItem.question },
      { type: "answer", text: faqItem.answer },
    ]);
  };

  const faqItems = FAQ_DATA[userRole] || FAQ_DATA.customer;
  const roleLabel = userRole.charAt(0).toUpperCase() + userRole.slice(1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Support Assistant
              </h1>
              <p className="text-muted-foreground">
                Get instant answers to your questions ({roleLabel})
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* FAQ Questions List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Frequently Asked Questions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {faqItems.map((faq, index) => (
                  <Button
                    key={index}
                    variant={selectedQuestion === faq.question ? "default" : "outline"}
                    className="w-full justify-start text-left h-auto py-3 px-4"
                    onClick={() => handleQuestionClick(faq)}
                  >
                    <div className="flex-1 text-sm">{faq.question}</div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Chat Window */}
          <Card className="flex flex-col">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Chat Window
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              {/* Chat Messages */}
              <div className="flex-1 p-4 space-y-4 min-h-[400px] max-h-[500px] overflow-y-auto">
                {chatHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                    <Bot className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-semibold mb-2">Welcome to Support Chat!</p>
                    <p className="text-sm">
                      Click on any question from the left to start a conversation.
                    </p>
                  </div>
                ) : (
                  chatHistory.map((item, index) => (
                    <div
                      key={index}
                      className={`flex ${item.type === "question" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          item.type === "question"
                            ? "bg-primary text-white"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {item.type === "answer" && (
                          <div className="flex items-center gap-2 mb-2">
                            <Bot className="h-4 w-4" />
                            <span className="text-xs font-semibold">Support Assistant</span>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{item.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Quick Actions */}
              {chatHistory.length > 0 && (
                <div className="border-t p-4 bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-2">Need more help?</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const randomFaq = faqItems[Math.floor(Math.random() * faqItems.length)];
                        handleQuestionClick(randomFaq);
                      }}
                    >
                      Ask Another Question
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setChatHistory([])}
                    >
                      Clear Chat
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* All FAQs in Accordion */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>All Questions & Answers</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SupportChat;

