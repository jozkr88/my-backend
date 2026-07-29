// ModelVisibilityContext.js
import React, { createContext, useContext, useState } from 'react';

const ModelVisibilityContext = createContext();

const ModelVisibilityProvider = ({ children }) => {
  const [visibleModel, setVisibleModel] = useState(null);

  const setModelVisible = (modelName) => {
    setVisibleModel(modelName);
  };

  const contextValue = {
    visibleModel,
    setModelVisible,
  };

  return (
    <ModelVisibilityContext.Provider value={contextValue}>
      {children}
    </ModelVisibilityContext.Provider>
  );
};

const useModelVisibility = () => {
  const context = useContext(ModelVisibilityContext);
  if (!context) {
    throw new Error('useModelVisibility must be used within a ModelVisibilityProvider');
  }
  return context;
};

export { ModelVisibilityProvider, useModelVisibility };
