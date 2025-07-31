import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useNativePermissions } from "@/hooks/useNativePermissions";
import { NativePermissionDialog } from "@/components/NativePermissionDialog";

export const NativePermissionManager = () => {
  const { user } = useAuth();
  const { isNativeApp, permissionState } = useNativePermissions();
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [permissionDialogCompleted, setPermissionDialogCompleted] = useState(false);

  // Handle native app permission flow - only show when user is logged in
  useEffect(() => {
    if (isNativeApp && user && permissionState.hasCheckedInitially && !permissionDialogCompleted) {
      // Show permission dialog only if user is logged in and permissions are not granted
      const needsPermissions = permissionState.location !== 'granted';
      if (needsPermissions) {
        setShowPermissionDialog(true);
      } else {
        setPermissionDialogCompleted(true);
      }
    }
  }, [isNativeApp, user, permissionState.hasCheckedInitially, permissionState.location, permissionDialogCompleted]);

  const handlePermissionDialogComplete = (hasRequiredPermissions: boolean) => {
    setShowPermissionDialog(false);
    setPermissionDialogCompleted(true);
    
    // You could add additional logic here based on permission results
    if (!hasRequiredPermissions) {
      console.log('⚠️ App running with limited permissions');
    } else {
      console.log('✅ App has all required permissions');
    }
  };

  return (
    <NativePermissionDialog
      isOpen={showPermissionDialog}
      onComplete={handlePermissionDialogComplete}
    />
  );
};