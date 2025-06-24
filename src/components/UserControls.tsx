
import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, LogOut } from 'lucide-react';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface UserControlsProps {
  user: SupabaseUser | null;
  onSignOut: () => Promise<void>;
  onAuthDialogOpen: () => void;
}

const UserControls: React.FC<UserControlsProps> = ({ user, onSignOut, onAuthDialogOpen }) => {
  const handleSignOut = async () => {
    console.log('Sign out button clicked');
    try {
      await onSignOut();
      console.log('Sign out completed successfully');
      // Force page reload to clear any remaining state
      window.location.reload();
    } catch (error) {
      console.error('Sign out error:', error);
      // Even if there's an error, try to reload the page to clear state
      window.location.reload();
    }
  };

  return (
    <div className="absolute top-[30px] right-[45px] z-20 flex items-start gap-2">
      {user ? (
        <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-md px-3 py-2 shadow-lg border border-input h-10">
          <Avatar className="w-6 h-6">
            <AvatarFallback className="text-xs">
              {user.email?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-foreground max-w-[100px] truncate">
            {user.email}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="h-6 w-6 p-0 hover:bg-accent hover:text-accent-foreground relative z-30 ml-1"
          >
            <LogOut className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <Button
          onClick={onAuthDialogOpen}
          variant="outline"
          size="default"
          className="bg-background/80 backdrop-blur-sm shadow-lg border border-input text-foreground hover:bg-accent hover:text-accent-foreground h-10"
        >
          <User className="w-4 h-4 mr-2" />
          Sign In
        </Button>
      )}
    </div>
  );
};

export default UserControls;
