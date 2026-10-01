import { createContext, useCallback, useContext, useRef, useState } from 'react';

const PetContext = createContext(null);

export function PetProvider({ children }) {
  const [bubble, setBubble] = useState(null); // { text, face, crisis }
  const [face, setFace] = useState('happy');
  const [action, setAction] = useState(null);
  const timer = useRef(null);

  const say = useCallback((msg, ms = 7000) => {
    clearTimeout(timer.current);
    setBubble(msg);
    if (msg.face) setFace(msg.face);
    if (msg.action) setAction(msg.action);
    if (!msg.crisis) {
      timer.current = setTimeout(() => {
        setBubble(null);
        setAction(null);
      }, ms);
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setBubble(null);
    setAction(null);
  }, []);

  return <PetContext.Provider value={{ bubble, face, setFace, action, say, dismiss }}>{children}</PetContext.Provider>;
}

export const usePet = () => useContext(PetContext);
