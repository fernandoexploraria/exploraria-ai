
import { useNavigate, useLocation } from 'react-router-dom';

export const useRouter = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return {
    navigate,
    location,
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
    state: location.state
  };
};
