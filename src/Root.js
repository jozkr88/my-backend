// Root.js
import React, { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter'; // If you still need wouter for some routing aspects

import LoadingScreen from './LoadingScreen';
import App from './App'; // Import your main App component

const Root = () => {
  const [, params] = useRoute('/world/:id');
  const [, setLocation] = useLocation();

  const [loading, setLoading] = useState(true);
  const [canvasReady, setCanvasReady] = useState(false);

  useEffect(() => {
    const asyncLoadCanvas = async () => {
      // Simulate loading canvas
      await new Promise((resolve) => setTimeout(resolve, 3000));
      setCanvasReady(true);
    };

    const asyncLoadScreen = async () => {
      // Simulate loading screen
      await new Promise((resolve) => setTimeout(resolve, 15000));
      setLoading(false);
    };

    asyncLoadCanvas();
    asyncLoadScreen();
  }, []);

  return (
    <>
      <LoadingScreen visible={loading} />
      {!loading && canvasReady && <App />}
    </>
  );
};

export default Root;
