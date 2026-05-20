import React, { createContext, useContext, ReactNode } from 'react';
import { IRootStore, createRootStore } from './RootStore';

const RootStoreContext = createContext<IRootStore | null>(null);

interface StoreProviderProps {
  children: ReactNode;
}

export function StoreProvider({ children }: StoreProviderProps) {
  const rootStore = createRootStore();

  return <RootStoreContext.Provider value={rootStore}>{children}</RootStoreContext.Provider>;
}

export function useRootStore(): IRootStore {
  const context = useContext(RootStoreContext);
  if (!context) {
    throw new Error('useRootStore must be used within StoreProvider');
  }
  return context;
}
