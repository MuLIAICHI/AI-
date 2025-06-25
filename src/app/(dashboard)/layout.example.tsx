'use client';

import { UserButton } from '@clerk/nextjs';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, User, History, Settings, Menu, X, Brain } from 'lucide-react';
import { useState } from 'react';

const navigation = [
  {
    name: 'Chat',
    href: '/chat',
    icon: MessageSquare,
    description: 'Start a conversation with AI',
  },
  {
    name: 'History',
    href: '/history',
    icon: History,
    description: 'View past conversations',
  },
  {
    name: 'Profile',
    href: '/profile',
    icon: User,
    description: 'Manage your profile',
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'App preferences',
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoaded } = useUser();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Show loading while user data loads
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <p className="text-slate-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-slate-900/90 backdrop-blur-sm border-r border-slate-800/50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-800/50">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Smartlyte AI</span>
            </div>
            
            {/* Close button for mobile */}
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-slate-800 transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* User Info */}
          <div className="p-6 border-b border-slate-800/50">
            <div className="flex items-center space-x-3">
              <UserButton 
                appearance={{
                  elements: {
                    avatarBox: "w-10 h-10",
                    userButtonPopoverCard: "bg-slate-800 border border-slate-700",
                    userButtonPopoverActionButton: "text-slate-300 hover:text-white hover:bg-slate-700",
                  }
                }}
              />
              <div>
                <p className="text-white font-medium">
                  {user?.firstName || 'User'}
                </p>
                <p className="text-slate-400 text-sm">
                  {user?.emailAddresses[0]?.emailAddress}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-6">
            <div className="space-y-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`
                      group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all
                      ${isActive 
                        ? 'bg-blue-600 text-white shadow-lg' 
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                      }
                    `}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className={`
                      mr-3 h-5 w-5 transition-colors
                      ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}
                    `} />
                    <div>
                      <p>{item.name}</p>
                      <p className={`
                        text-xs 
                        ${isActive ? 'text-blue-100' : 'text-slate-500 group-hover:text-slate-400'}
                      `}>
                        {item.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Footer */}
          <div className="p-6 border-t border-slate-800/50">
            <div className="text-center">
              <p className="text-xs text-slate-500">
                Powered by Smartlyte AI
              </p>
              <p className="text-xs text-slate-600 mt-1">
                v1.0.0
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:pl-80">
        {/* Mobile Header */}
        <div className="lg:hidden sticky top-0 z-40 bg-slate-900/90 backdrop-blur-sm border-b border-slate-800/50">
          <div className="flex items-center justify-between px-4 py-4">
            <button
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6 text-white" />
            </button>
            
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded flex items-center justify-center">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">Smartlyte AI</span>
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

        {/* Page Content */}
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}