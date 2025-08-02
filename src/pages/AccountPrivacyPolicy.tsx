import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AccountPrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Sticky Header with proper iOS safe area support */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b safe-area-header">
        <div className="max-w-4xl mx-auto px-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-8">
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-foreground">Privacy Policy</h1>
            
            <div className="bg-card p-4 sm:p-6 rounded-lg border border-border">
              <div className="space-y-4 sm:space-y-6 text-sm leading-relaxed text-muted-foreground">
                <p>
                  At Exploraria, we respect and protect the privacy of our users. This Privacy Policy outlines the types of personal information we collect, how we use it, and how we protect your information.
                </p>

                <div>
                  <h2 className="text-lg sm:text-xl font-semibold mb-4 text-foreground">Information We Collect</h2>
                  <p className="mb-4">
                    When you use our app, we may collect the following types of personal information:
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>
                      <strong>Device Information:</strong> We may collect information about the type of device you use, its operating system, and other technical details to help us improve our app.
                    </li>
                    <li>
                      <strong>Usage Information:</strong> We may collect information about how you use our app, such as which features you use and how often you use them.
                    </li>
                    <li>
                      <strong>Personal Information:</strong> We may collect personal information, such as your name, email address, or phone number, if you choose to provide it to us.
                    </li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-lg sm:text-xl font-semibold mb-4 text-foreground">How We Use Your Information</h2>
                  <p className="mb-4">
                    We use your information for the following purposes:
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>
                      <strong>To provide and improve our app:</strong> We use your information to provide and improve our app, including to personalize your experience and to analyze how our app is used.
                    </li>
                    <li>
                      <strong>To communicate with you:</strong> We may use your information to communicate with you about our app, including to provide you with updates and news about our app.
                    </li>
                    <li>
                      <strong>To protect our rights and the rights of others:</strong> We may use your information to protect our rights and the rights of others, such as to investigate and prevent fraud or other illegal activity.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountPrivacyPolicy;