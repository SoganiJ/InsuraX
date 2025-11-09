"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  HelpCircle, 
  MessageSquare, 
  Phone, 
  Mail, 
  Bot, 
  ChevronDown, 
  ChevronUp,
  Search,
  Send
} from "lucide-react";

export default function SupportSection() {
  const [selectedTab, setSelectedTab] = useState("faq");
  const [searchQuery, setSearchQuery] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [aiMessages, setAiMessages] = useState([
    {
      sender: "ai",
      message: "Hi! I'm your AI assistant. I can help you with policy questions, claim guidance, and general insurance information. What would you like to know?",
      timestamp: new Date().toISOString()
    }
  ]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const faqData = [
    {
      category: "General",
      questions: [
        {
          question: "How do I file a new insurance claim?",
          answer: "You can file a new claim by going to the 'File a Claim' section in your dashboard. Follow the step-by-step process to submit your claim with all required documents."
        },
        {
          question: "How can I track my claim status?",
          answer: "Visit the 'Claims Management' section to view all your claims and their current status. You can also communicate with your assigned adjuster directly."
        },
        {
          question: "What documents do I need for a claim?",
          answer: "Required documents vary by claim type. Generally, you'll need incident reports, photos, medical bills (for health claims), or repair estimates (for auto claims)."
        }
      ]
    },
    {
      category: "Payments",
      questions: [
        {
          question: "How do I pay my premium?",
          answer: "You can pay your premium online through the payment section in your dashboard. We accept credit cards, debit cards, and net banking."
        },
        {
          question: "When is my premium due?",
          answer: "Premium due dates are shown in your policy details. You'll receive reminders via email and SMS before the due date."
        },
        {
          question: "Can I set up automatic payments?",
          answer: "Yes, you can set up auto-pay in your account settings. This ensures your premium is paid automatically on the due date."
        }
      ]
    },
    {
      category: "Policy Management",
      questions: [
        {
          question: "How do I renew my policy?",
          answer: "Policy renewal can be done online through your dashboard. You'll receive renewal notifications 30 days before expiry."
        },
        {
          question: "Can I modify my policy coverage?",
          answer: "Yes, you can request policy modifications through the 'My Policies' section. Changes may affect your premium amount."
        },
        {
          question: "How do I download my policy documents?",
          answer: "All policy documents are available in the 'My Policies' section. You can download them anytime for your records."
        }
      ]
    }
  ];

  const filteredFAQs = faqData.map(category => ({
    ...category,
    questions: category.questions.filter(q => 
      q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.questions.length > 0);

  const handleSendMessage = () => {
    if (chatMessage.trim()) {
      // In real app, this would send to support team
      console.log("Sending message:", chatMessage);
      setChatMessage("");
    }
  };

  const handleAIMessage = async () => {
    if (aiMessage.trim()) {
      const userMessage = aiMessage.trim();
      
      // Add user message to chat
      setAiMessages(prev => [...prev, {
        sender: "user",
        message: userMessage,
        timestamp: new Date().toISOString()
      }]);
      
      setAiMessage("");
      setIsAiLoading(true);

      try {
        // Call Gemini API
        const response = await fetch('/api/ai-assistant', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: userMessage }),
        });

        if (!response.ok) {
          throw new Error('Failed to get AI response');
        }

        const data = await response.json();
        
        // Add AI response to chat
        setAiMessages(prev => [...prev, {
          sender: "ai",
          message: data.message,
          timestamp: data.timestamp
        }]);

      } catch (error) {
        console.error('AI Assistant Error:', error);
        
        // Add error message to chat
        setAiMessages(prev => [...prev, {
          sender: "ai",
          message: "I'm sorry, I'm having trouble responding right now. Please try again later or contact our support team for immediate assistance.",
          timestamp: new Date().toISOString()
        }]);
      } finally {
        setIsAiLoading(false);
      }
    }
  };

  const supportOptions = [
    {
      title: "FAQs",
      description: "Find answers to common questions",
      icon: <HelpCircle className="w-8 h-8 text-blue-400" />,
      id: "faq"
    },
    {
      title: "Contact Us",
      description: "Call or email our support team",
      icon: <Phone className="w-8 h-8 text-green-400" />,
      id: "contact"
    },
    {
      title: "Live Chat",
      description: "Chat with our support team instantly",
      icon: <MessageSquare className="w-8 h-8 text-yellow-400" />,
      id: "chat"
    },
    {
      title: "AI Assistant",
      description: "Get instant help from our AI assistant",
      icon: <Bot className="w-8 h-8 text-purple-400" />,
      id: "ai"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-white mb-2">Support Center</h1>
          <p className="text-slate-400">Get help and support for all your insurance needs</p>
        </motion.div>

        {/* Support Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {supportOptions.map((option, i) => (
            <motion.div
              key={option.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
            >
              <Card 
                className={`cursor-pointer transition-all duration-300 ${
                  selectedTab === option.id 
                    ? "bg-blue-600/20 border-blue-500/50" 
                    : "bg-slate-800/70 border-slate-700 hover:bg-slate-700"
                }`}
                onClick={() => setSelectedTab(option.id)}
              >
                <CardContent className="p-4 text-center">
                  {option.icon}
                  <h3 className="font-semibold text-white mt-2">{option.title}</h3>
                  <p className="text-slate-400 text-sm">{option.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Content Area */}
        <motion.div
          key={selectedTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* FAQs Tab */}
          {selectedTab === "faq" && (
            <Card className="bg-slate-800/70 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <HelpCircle className="w-5 h-5" />
                  Frequently Asked Questions
                </CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search FAQs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {filteredFAQs.map((category, categoryIndex) => (
                  <div key={categoryIndex}>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                        {category.category}
                      </Badge>
                    </h3>
                    <div className="space-y-3">
                      {category.questions.map((faq, faqIndex) => (
                        <FAQItem key={faqIndex} question={faq.question} answer={faq.answer} />
                      ))}
                    </div>
                  </div>
                ))}
                {filteredFAQs.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-slate-400">No FAQs found matching your search.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Contact Us Tab */}
          {selectedTab === "contact" && (
            <Card className="bg-slate-800/70 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Phone className="w-5 h-5" />
                  Contact Us
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Phone Support */}
                  <div className="bg-slate-700/50 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Phone className="w-6 h-6 text-green-400" />
                      <h3 className="text-lg font-semibold text-white">Phone Support</h3>
                    </div>
                    <p className="text-slate-300 mb-4">Call us for immediate assistance</p>
                    <div className="space-y-2">
                      <p className="text-white font-medium">Toll-Free: 1800-123-4567</p>
                      <p className="text-white font-medium">Mobile: +91 98765 43210</p>
                      <p className="text-slate-400 text-sm">Available 24/7</p>
                    </div>
                    <Button className="mt-4 bg-green-600 hover:bg-green-700">
                      <Phone className="w-4 h-4 mr-2" />
                      Call Now
                    </Button>
                  </div>

                  {/* Email Support */}
                  <div className="bg-slate-700/50 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Mail className="w-6 h-6 text-blue-400" />
                      <h3 className="text-lg font-semibold text-white">Email Support</h3>
                    </div>
                    <p className="text-slate-300 mb-4">Send us your queries via email</p>
                    <div className="space-y-2">
                      <p className="text-white font-medium">support@insurax.com</p>
                      <p className="text-white font-medium">claims@insurax.com</p>
                      <p className="text-slate-400 text-sm">Response within 2 hours</p>
                    </div>
                    <Button className="mt-4 bg-blue-600 hover:bg-blue-700">
                      <Mail className="w-4 h-4 mr-2" />
                      Send Email
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Live Chat Tab */}
          {selectedTab === "chat" && (
            <Card className="bg-slate-800/70 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Live Chat Support
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-700/50 rounded-lg p-6">
                  <div className="mb-4">
                    <p className="text-slate-300 mb-2">Chat with our support team in real-time</p>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      Online Now
                    </Badge>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-slate-600/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        <span className="text-white font-medium">Support Agent</span>
                      </div>
                      <p className="text-slate-300">Hello! How can I help you today?</p>
                    </div>
                    
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type your message..."
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        className="flex-1 bg-slate-700 border-slate-600 text-white"
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      />
                      <Button onClick={handleSendMessage} className="bg-green-600 hover:bg-green-700">
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Assistant Tab */}
          {selectedTab === "ai" && (
            <Card className="bg-slate-800/70 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  AI Assistant
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-700/50 rounded-lg p-6">
                  <div className="mb-4">
                    <p className="text-slate-300 mb-2">Get instant help from our AI assistant</p>
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                      AI Powered
                    </Badge>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Chat Messages */}
                    <div className="max-h-96 overflow-y-auto space-y-3">
                      {aiMessages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-xs p-3 rounded-lg ${
                            msg.sender === 'user' 
                              ? 'bg-purple-600 text-white' 
                              : 'bg-slate-600/50 text-slate-200'
                          }`}>
                            <div className="flex items-center gap-2 mb-1">
                              {msg.sender === 'ai' && <Bot className="w-3 h-3 text-purple-400" />}
                              <span className="text-xs opacity-70">
                                {msg.sender === 'user' ? 'You' : 'AI Assistant'}
                              </span>
                            </div>
                            <p className="text-sm">{msg.message}</p>
                            <p className="text-xs opacity-50 mt-1">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))}
                      
                      {/* Loading indicator */}
                      {isAiLoading && (
                        <div className="flex justify-start">
                          <div className="bg-slate-600/50 text-slate-200 p-3 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Bot className="w-3 h-3 text-purple-400" />
                              <span className="text-xs opacity-70">AI Assistant</span>
                            </div>
                            <div className="flex items-center gap-1 mt-2">
                              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Message Input */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ask me anything about insurance..."
                        value={aiMessage}
                        onChange={(e) => setAiMessage(e.target.value)}
                        className="flex-1 bg-slate-700 border-slate-600 text-white"
                        onKeyPress={(e) => e.key === 'Enter' && !isAiLoading && handleAIMessage()}
                        disabled={isAiLoading}
                      />
                      <Button 
                        onClick={handleAIMessage} 
                        disabled={isAiLoading || !aiMessage.trim()}
                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// FAQ Item Component
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-slate-600 rounded-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 text-left flex justify-between items-center hover:bg-slate-700/50 transition-colors"
      >
        <span className="text-white font-medium">{question}</span>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4">
          <p className="text-slate-300">{answer}</p>
        </div>
      )}
    </div>
  );
}
