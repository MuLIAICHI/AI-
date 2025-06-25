import { UserButton } from '@clerk/nextjs';
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { MessageSquare, Send, Sparkles } from 'lucide-react';

export default async function ChatPage() {
  // Get the current user from Clerk
  const user = await currentUser();

  // If no user, redirect to sign-in (backup protection)
  if (!user) {
    redirect('/sign-in');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-800/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Smartlyte AI</span>
            </div>

            {/* User Info & Menu */}
            <div className="flex items-center space-x-4">
              <div className="text-sm text-slate-300">
                Welcome, <span className="text-white font-medium">{user.firstName || user.emailAddresses[0]?.emailAddress}</span>
              </div>
              <UserButton 
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8",
                    userButtonPopoverCard: "bg-slate-800 border border-slate-700",
                    userButtonPopoverActionButton: "text-slate-300 hover:text-white hover:bg-slate-700",
                  }
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Chat Interface */}
      <div className="flex flex-1">
        {/* Sidebar - Chat History */}
        <div className="w-80 bg-slate-900/50 border-r border-slate-800/50 p-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">Conversations</h2>
            <button className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
              <MessageSquare className="w-4 h-4 text-white" />
            </button>
          </div>
          
          {/* Coming Soon Message */}
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-400 text-sm">
              Your conversation history will appear here
            </p>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Messages Area */}
          <div className="flex-1 p-6">
            {/* Welcome Message */}
            <div className="max-w-4xl mx-auto">
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <MessageSquare className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-4">
                  Welcome to Smartlyte AI!
                </h1>
                <p className="text-lg text-slate-300 mb-8 max-w-2xl mx-auto">
                  I'm your intelligent learning assistant. I can help you with digital skills, 
                  financial literacy, and health & wellness topics. What would you like to learn about today?
                </p>
                
                {/* Quick Start Cards */}
                <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-blue-500/50 transition-all cursor-pointer">
                    <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">Digital Skills</h3>
                    <p className="text-slate-400 text-sm">Email, web browsing, apps, and online safety</p>
                  </div>
                  
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-green-500/50 transition-all cursor-pointer">
                    <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">Financial Literacy</h3>
                    <p className="text-slate-400 text-sm">Budgeting, banking, savings, and investments</p>
                  </div>
                  
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-red-500/50 transition-all cursor-pointer">
                    <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">Health & Wellness</h3>
                    <p className="text-slate-400 text-sm">NHS apps, appointments, and health resources</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Input Area */}
          <div className="border-t border-slate-800/50 p-6">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center space-x-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Ask me anything about digital skills, finance, or health..."
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-6 py-4 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                    <p className="text-xs text-slate-500">Coming soon...</p>
                  </div>
                </div>
                <button 
                  disabled
                  className="p-4 bg-slate-700 rounded-xl text-slate-500 cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              
              <div className="text-center mt-4">
                <p className="text-xs text-slate-500">
                  🚧 Chat functionality coming soon! We're building the AI agents integration.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}