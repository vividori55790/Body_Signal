import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AcutePainMode from '../components/AcutePainMode';

interface AcutePainContextType {
  isOpen: boolean;
  openAcute: () => void;
  closeAcute: () => void;
}

const AcutePainContext = createContext<AcutePainContextType>({
  isOpen: false,
  openAcute: () => {},
  closeAcute: () => {},
});

export const useAcutePain = () => useContext(AcutePainContext);

export const AcutePainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Listen to query params (e.g., /?mode=acute) or route (/acute)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('mode') === 'acute' || location.pathname === '/acute') {
      setIsOpen(true);
    }
  }, [location.search, location.pathname]);

  const openAcute = () => setIsOpen(true);
  const closeAcute = () => {
    setIsOpen(false);
    // If we were on /acute or had ?mode=acute, clean up URL without reloading
    const params = new URLSearchParams(location.search);
    if (params.has('mode')) {
      params.delete('mode');
      const newSearch = params.toString() ? `?${params.toString()}` : '';
      navigate(`${location.pathname}${newSearch}`, { replace: true });
    } else if (location.pathname === '/acute') {
      navigate('/', { replace: true });
    }
  };

  return (
    <AcutePainContext.Provider value={{ isOpen, openAcute, closeAcute }}>
      {children}
      {isOpen && <AcutePainMode onClose={closeAcute} />}
    </AcutePainContext.Provider>
  );
};

export default AcutePainProvider;
