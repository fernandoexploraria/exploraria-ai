import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Shield, FileText, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';

const Account: React.FC = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Main Page
          </Button>
        </div>
        
        <div className="bg-card p-6 rounded-lg border">
          <h1 className="text-3xl font-bold mb-8">Account</h1>
          
          <div className="space-y-4">
            <Button 
              variant="outline" 
              className="w-full justify-start gap-3 h-12"
            >
              <User className="w-5 h-5" />
              Personal Info
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full justify-start gap-3 h-12"
              onClick={() => navigate('/account-privacy-policy')}
            >
              <Shield className="w-5 h-5" />
              Privacy Policy
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full justify-start gap-3 h-12"
              onClick={() => navigate('/terms-of-use')}
            >
              <FileText className="w-5 h-5" />
              Terms of Use
            </Button>
            
            <Button 
              variant="destructive" 
              className="w-full justify-start gap-3 h-12"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Account;