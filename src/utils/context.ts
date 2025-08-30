import React from 'react';

export function createContext<T>(name: string) {
  const Context = React.createContext<T | undefined>(undefined);
  Context.displayName = name;
  
  return {
    Provider: Context.Provider,
    useContext: () => {
      const context = React.useContext(Context);
      if (context === undefined) {
        throw new Error(`use${name} must be used within a ${name}Provider`);
      }
      return context;
    },
  };
}
