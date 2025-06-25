import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex flex-col items-center justify-center space-y-6">
      {/* Welcome Text */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-2">
          Welcome Back
        </h1>
        <p className="text-slate-300">
          Sign in to continue your learning journey with Smartlyte AI
        </p>
      </div>

      {/* Clerk Sign-In Component */}
      <SignIn 
        appearance={{
          elements: {
            rootBox: "w-full",
            card: "bg-transparent shadow-none border-0",
            headerTitle: "text-white",
            headerSubtitle: "text-slate-300",
            socialButtonsBlockButton: "bg-slate-800 border-slate-600 text-white hover:bg-slate-700",
            socialButtonsBlockButtonText: "text-white",
            formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white",
            formFieldInput: "bg-slate-800 border-slate-600 text-white",
            formFieldLabel: "text-slate-300",
            identityPreviewText: "text-white",
            identityPreviewEditButton: "text-blue-400 hover:text-blue-300",
            formResendCodeLink: "text-blue-400 hover:text-blue-300",
            footerActionLink: "text-blue-400 hover:text-blue-300",
            dividerLine: "bg-slate-600",
            dividerText: "text-slate-400",
            formFieldSuccessText: "text-green-400",
            formFieldErrorText: "text-red-400",
            alertText: "text-red-400",
            formFieldInputShowPasswordButton: "text-slate-400 hover:text-white",
          },
        }}
      />
    </div>
  );
}