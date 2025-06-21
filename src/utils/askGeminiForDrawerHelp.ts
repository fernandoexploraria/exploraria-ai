
import { useGeminiAPI } from '@/hooks/useGeminiAPI';

export const useDrawerHelp = () => {
  const { callGemini, isLoading } = useGeminiAPI();

  const askForDrawerHelp = async () => {
    const prompt = `I'm using the Vaul drawer library in React/TypeScript and I'm getting this error:

"Property 'shouldCloseOnInteractOutside' does not exist on type 'IntrinsicAttributes & DialogProps'."

I'm trying to prevent the drawer from closing when users click outside of it. The drawer is imported from vaul and I'm using it like this:

<Drawer open={open} onOpenChange={onOpenChange} modal={true}>

What are the correct props to prevent the drawer from closing on outside clicks? Can you provide the exact prop names and values that work with the Vaul library?`;

    const response = await callGemini(prompt);
    return response;
  };

  return { askForDrawerHelp, isLoading };
};
