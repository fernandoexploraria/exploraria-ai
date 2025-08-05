
export type PostAuthAction = 'smart-tour' | 'intelligent-tour' | 'navigate-main' | 'none';

const AUTH_ACTION_KEY = 'pending-auth-action';
const AUTH_LANDMARK_KEY = 'pending-auth-landmark';

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

export const setPostAuthLandmark = (landmark: any) => {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(AUTH_LANDMARK_KEY, JSON.stringify(landmark));
  }
};

export const getPostAuthLandmark = () => {
  if (typeof window !== 'undefined') {
    const landmark = sessionStorage.getItem(AUTH_LANDMARK_KEY);
    return landmark ? JSON.parse(landmark) : null;
  }
  return null;
};

export const clearPostAuthLandmark = () => {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(AUTH_LANDMARK_KEY);
  }
};
