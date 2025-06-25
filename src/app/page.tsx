import Link from 'next/link';
import { ArrowRight, MessageSquare, Brain, Shield, Zap, Users, Star } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-800/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Smartlyte AI</span>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-slate-300 hover:text-white transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="text-slate-300 hover:text-white transition-colors">
                How it Works
              </a>
              <a href="#about" className="text-slate-300 hover:text-white transition-colors">
                About
              </a>
            </nav>

            {/* Auth Buttons */}
            <div className="flex items-center space-x-4">
              <Link 
                href="/sign-in"
                className="text-slate-300 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link 
                href="/sign-up"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Learn Essential Skills with
              <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-green-400 text-transparent bg-clip-text">
                {" "}AI Guidance
              </span>
            </h1>
            
            <p className="text-xl text-slate-300 mb-8 leading-relaxed max-w-2xl mx-auto">
              Smartlyte AI helps you build confidence in digital, financial, and health skills 
              through personalized conversations with intelligent learning assistants.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link 
                href="/sign-up"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all transform hover:scale-105"
              >
                Start Learning Free
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link 
                href="#how-it-works"
                className="border border-slate-600 hover:border-slate-500 text-white px-8 py-4 rounded-lg font-semibold transition-colors"
              >
                See How It Works
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">3</div>
                <div className="text-sm text-slate-400">AI Specialists</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">24/7</div>
                <div className="text-sm text-slate-400">Available</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">Free</div>
                <div className="text-sm text-slate-400">To Start</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-slate-800/50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Three Specialized Learning Assistants
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Each AI assistant is trained to help you master specific skill areas with personalized guidance.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Digital Mentor */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8 hover:border-blue-500/50 transition-all">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-6">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">Digital Mentor</h3>
              <p className="text-slate-300 mb-6">
                Master technology essentials like email, web browsing, mobile apps, password management, and online safety.
              </p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-blue-400" />
                  Email setup & management
                </li>
                <li className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-blue-400" />
                  Internet safety & security
                </li>
                <li className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-blue-400" />
                  Mobile app guidance
                </li>
              </ul>
            </div>

            {/* Finance Guide */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8 hover:border-green-500/50 transition-all">
              <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mb-6">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">Finance Guide</h3>
              <p className="text-slate-300 mb-6">
                Build financial confidence with budgeting, banking, saving strategies, and understanding money management tools.
              </p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-green-400" />
                  Personal budgeting help
                </li>
                <li className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-green-400" />
                  Online banking guidance
                </li>
                <li className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-green-400" />
                  Savings & investment basics
                </li>
              </ul>
            </div>

            {/* Health Coach */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8 hover:border-red-500/50 transition-all">
              <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center mb-6">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">Health Coach</h3>
              <p className="text-slate-300 mb-6">
                Navigate digital health resources like NHS apps, online appointments, and find reliable health information.
              </p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-red-400" />
                  NHS app navigation
                </li>
                <li className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-red-400" />
                  Online appointment booking
                </li>
                <li className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-red-400" />
                  Health info verification
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Simple, Conversational Learning
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Just start a conversation and our AI will guide you to the right learning assistant for your needs.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">1. Start Chatting</h3>
              <p className="text-slate-300">
                Simply type your question or describe what you want to learn. No complex setup required.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">2. AI Routes You</h3>
              <p className="text-slate-300">
                Our intelligent router connects you with the perfect specialist assistant for your topic.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">3. Learn Together</h3>
              <p className="text-slate-300">
                Get personalized guidance, step-by-step instructions, and build confidence at your own pace.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Start Learning?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of learners building essential digital, financial, and health skills with AI guidance.
          </p>
          <Link 
            href="/sign-up"
            className="bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors inline-flex items-center gap-2"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-12 px-4">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Smartlyte AI</span>
            </div>
            
            <div className="flex space-x-6 text-sm text-slate-400">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Support</a>
            </div>
          </div>
          
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-slate-400">
            <p>&copy; 2024 Smartlyte AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}