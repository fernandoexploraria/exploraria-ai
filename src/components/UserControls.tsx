
import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, LogOut } from 'lucide-react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import TourCounter from '@/components/TourCounter';

interface UserControlsProps {
  user: SupabaseUser | null;
  onSignOut: () => Promise<void>;
  onAuthDialogOpen: () => void;
}

const UserControls: React.FC<UserControlsProps> = ({ user, onSignOut, onAuthDialogOpen }) => {
  return (
    <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
      {user ? (
        <>
          <TourCounter />
          <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm">
            <Avatar className="w-6 h-6">
              <AvatarFallback className="text-xs">
                {user.email?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-gray-700 max-w-[100px] truncate">
              {user.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSignOut}
              className="h-6 w-6 p-0 hover:bg-gray-100"
            >
              <LogOut className="w-3 h-3" />
            </Button>
          </div>
        </>
      ) : (
        <Button
          onClick={onAuthDialogOpen}
          variant="default"
          size="sm"
          className="bg-white/90 backdrop-blur-sm text-gray-900 hover:bg-white"
        >
          <User className="w-4 h-4 mr-2" />
          Sign In
        </Button>
      )}
    </div>
  );
};

export default UserControls;
