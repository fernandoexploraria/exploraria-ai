
export type PostAuthAction = 'smart-tour' | 'none';

const AUTH_ACTION_KEY = 'pending-auth-action';

export const setPostAuthAction = (action: PostAuthAction) => {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(AUTH_ACTION_KEY, action);
  }
};

export const getPostAuthAction = (): PostAuthAction => {
  if (typeof window !== 'undefined') {
    const action = sessionStorage.getItem(AUTH_ACTION_KEY) as PostAuthAction;
    return action || 'none';
  }
  return 'none';
};

export const clearPostAuthAction = () => {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(AUTH_ACTION_KEY);
  }
};
