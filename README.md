
# Exploraria AI - Travel Discovery App

**URL**: https://lovable.dev/projects/1349ca1f-6be1-4b1d-9873-44f9d88cdaf0

## Architecture Overview

Exploraria AI is a travel discovery application built with React, TypeScript, and Supabase. The app uses AI-powered landmark recognition, real-time location tracking, and immersive street view experiences to help users explore and discover places around the world.

## ⚠️ IMPORTANT: API Policy

**NO OPENAI USAGE**: This project explicitly does NOT use OpenAI APIs. All AI functionality is powered by Google's Gemini AI. Any future development should maintain this policy.

## Current API Integrations

### Core AI & Language Services
- **Google Gemini AI** - Primary AI engine for chat, landmark analysis, and content generation
- **Google Cloud Text-to-Speech** - Audio narration for landmarks and memories
- **Google Speech-to-Text** - Voice input processing

### Location & Mapping Services
- **Google Places API** - Location search, nearby places, and place details
- **Google Street View API** - Street-level imagery and panoramic views
- **Mapbox** - Interactive maps and navigation

### Payment & Subscription
- **Stripe** - Payment processing and subscription management

### Backend & Database
- **Supabase** - Authentication, database, real-time subscriptions, and edge functions

### Optional Integrations
- **ElevenLabs** - Advanced voice synthesis (when configured)

## Required API Keys

The following API keys must be configured as Supabase secrets for the application to function properly:

### Core Required Keys

| Secret Name | Purpose | Where to Get |
|-------------|---------|--------------|
| `GOOGLE_API_KEY` | Google Places API, Geocoding API, and Street View API | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_AI_API_KEY` | Google Gemini AI for chat and content generation | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `MAPBOX_TOKEN` | Interactive maps and navigation | [Mapbox Account](https://account.mapbox.com/access-tokens/) |
| `STRIPE_SECRET_KEY` | Payment processing and subscriptions | [Stripe Dashboard](https://dashboard.stripe.com/apikeys) |

### Optional Keys

| Secret Name | Purpose | Where to Get |
|-------------|---------|--------------|
| `ELEVENLABS_API_KEY` | Advanced voice synthesis (when configured) | [ElevenLabs](https://elevenlabs.io/app/settings/api-keys) |

### Setting Up API Keys

1. **In Supabase Dashboard**: Navigate to Project Settings → Edge Functions → Secrets
2. **Add each secret** using the exact names listed above (case-sensitive)
3. **Enable required APIs** in Google Cloud Console for `GOOGLE_API_KEY`:
   - Places API
   - Geocoding API
   - Street View Static API
   - Maps JavaScript API

**Important**: Use the exact secret names as documented above. These names match the `Deno.env.get()` calls in the edge functions.

## API Integration Guidelines

### Adding New APIs

When adding new API integrations, follow these steps:

1. **Update this documentation FIRST** - Add the new API to the "Current API Integrations" section
2. **Add environment variables** - Use descriptive names and document them
3. **Create edge functions** - Place API calls in Supabase edge functions for security
4. **Update types** - Add TypeScript definitions for new API responses
5. **Add error handling** - Implement proper error boundaries and fallbacks

### API Key Management

All API keys are stored securely in Supabase edge function secrets. Never expose API keys in client-side code.

## Project Structure

### Frontend (React/TypeScript)
- `src/components/` - React components organized by feature
- `src/hooks/` - Custom React hooks for API integration and state management
- `src/pages/` - Main application pages
- `src/contexts/` - React context providers
- `src/integrations/` - Third-party service integrations

### Backend (Supabase Edge Functions)
- `supabase/functions/` - Serverless functions for API integrations
- `supabase/migrations/` - Database schema migrations

## Key Features

- **AI-Powered Landmark Recognition** - Using Google Gemini Vision API
- **Real-time Location Tracking** - GPS-based proximity alerts
- **Immersive Street View** - Google Street View integration
- **Voice Interactions** - Speech-to-text and text-to-speech
- **Tour Planning** - AI-generated personalized tours
- **Photo Management** - Enhanced photo carousel with metadata
- **Subscription Management** - Stripe-powered premium features

## Development Guidelines

### Code Organization
- Keep components small and focused (under 50 lines when possible)
- Use custom hooks for complex logic
- Implement proper TypeScript typing
- Follow React best practices

### API Integration Standards
- All external API calls must go through Supabase edge functions
- Implement proper error handling and loading states
- Use React Query for data fetching and caching
- Add console logging for debugging API interactions

## How to Edit This Code

There are several ways of editing your application:

**Use Lovable**
Simply visit the [Lovable Project](https://lovable.dev/projects/1349ca1f-6be1-4b1d-9873-44f9d88cdaf0) and start prompting.

**Use your preferred IDE**
If you want to work locally using your own IDE, you can clone this repo and push changes.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

## Technologies Used

This project is built with:
- **Frontend**: Vite, TypeScript, React, Tailwind CSS, shadcn-ui
- **Backend**: Supabase (PostgreSQL, Edge Functions, Authentication)
- **AI**: Google Gemini AI (NO OpenAI)
- **Maps**: Google Maps API, Mapbox
- **Payments**: Stripe

## Deployment

Simply open [Lovable](https://lovable.dev/projects/1349ca1f-6be1-4b1d-9873-44f9d88cdaf0) and click on Share → Publish.

## Custom Domain

You can connect a custom domain by navigating to Project > Settings > Domains and clicking Connect Domain.

Read more: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

---

## For Future AI Assistants

**CRITICAL**: This project uses Google Gemini AI exclusively. Do NOT suggest or implement OpenAI integrations. When adding new APIs, update this documentation first and follow the API Integration Guidelines above.

The exact API secret names used in the codebase are documented in the "Required API Keys" section above. Always use these exact names when referencing or setting up API keys.
