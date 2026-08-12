import { createContext, useContext } from 'react';
import type { Me } from './types';

const UserCtx = createContext<Me | null>(null);

export const UserProvider = UserCtx.Provider;

export function useUser(): Me {
  const me = useContext(UserCtx);
  if (!me) throw new Error('useUser must be used inside UserProvider');
  return me;
}