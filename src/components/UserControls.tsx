
import React from 'react';
import { Button } from '@/components/ui/button';
import { User, LogOut } from 'lucide-react';

interface UserControlsProps {
  user: any;
  onSignOut: () => void;
  onAuthDialogOpen: () => void;
}

const UserControls: React.FC<UserControlsProps> = ({
  user,
  onSignOut,
  onAuthDialogOpen
}) => {
  return (
    <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
      {user ? (
        <>
          <span className="text-sm bg-background/80 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg">
            {user.email}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="bg-background/80 backdrop-blur-sm shadow-lg"
            onClick={onSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          className="bg-background/80 backdrop-blur-sm shadow-lg"
          onClick={onAuthDialogOpen}
        >
          <User className="mr-2 h-4 w-4" />
          Sign In
        </Button>
      )}
    </div>
  );
};

export default UserControls;
