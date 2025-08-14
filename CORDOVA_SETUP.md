# Cordova Apple Pay Setup Instructions

## 1. Install Cordova Plugin
Run this command in your project directory:
```bash
cordova plugin add cordova-plugin-purchase
```

## 2. Configure Xcode
1. Open your iOS project in Xcode
2. Select your app target
3. Go to "Signing & Capabilities"
4. Click "+ Capability" and add "In-App Purchase"

## 3. Get Apple Shared Secret
1. Go to App Store Connect
2. Select your app
3. Go to "App Information" 
4. Find "App-Specific Shared Secret"
5. Generate if needed and copy the secret
6. Add this secret to your Supabase project using the secret name: `APPLE_SHARED_SECRET`

## 4. Test with Sandbox
- Use your sandbox test account: admin@exploraria.ai
- Product ID LEXPS0001 should be configured in App Store Connect
- Test on a physical iOS device (simulators don't support In-App Purchases)

## 5. What's Implemented
- "Subscribe with Apple" buttons appear when running in Cordova environment
- Apple receipt validation via `verify-apple-receipt` edge function
- Subscription status syncs with your existing `subscribers` table
- Works alongside existing Stripe subscriptions

## 6. Next Steps
After testing, you can:
- Add Apple Server-to-Server notifications for real-time updates
- Implement subscription management features
- Add restore purchases functionality

## Files Created/Modified
- `supabase/functions/verify-apple-receipt/index.ts` - Apple receipt validation
- `src/hooks/useCordovaSubscription.ts` - Cordova purchase logic
- `src/components/FreeTourCounter.tsx` - Added Apple Pay buttons
- `supabase/functions/check-subscription/index.ts` - Updated for Apple support