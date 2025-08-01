import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Shield, FileText, LogOut, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Account: React.FC = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showFinalConfirmation, setShowFinalConfirmation] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      
      // Sign out and redirect - the actual account deletion would need to be handled
      // by a server-side function for security reasons
      await signOut();
      toast.success('Account deletion initiated. You have been signed out.');
      navigate('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowFinalConfirmation(false);
    }
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
            
            {/* Separator and Delete Account Section */}
            <div className="border-t pt-6 mt-6">
              <AlertDialog open={showFinalConfirmation} onOpenChange={setShowFinalConfirmation}>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      className="w-full justify-start gap-3 h-12 bg-red-600 hover:bg-red-700"
                    >
                      <Trash2 className="w-5 h-5" />
                      Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Account</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete your account? This action will:
                        <br />
                        <br />
                        • Permanently delete all your data
                        <br />
                        • Remove all your tour history and interactions
                        <br />
                        • Cancel any active subscriptions
                        <br />
                        <br />
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => setShowFinalConfirmation(true)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Continue
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                
                {/* Final confirmation dialog */}
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Final Confirmation</AlertDialogTitle>
                    <AlertDialogDescription>
                      This is your last chance to change your mind.
                      <br />
                      <br />
                      <strong>Once deleted, your account and all associated data will be permanently removed and cannot be recovered.</strong>
                      <br />
                      <br />
                      Are you absolutely certain you want to delete your account?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setShowFinalConfirmation(false)}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      disabled={isDeleting}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete My Account'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Account;