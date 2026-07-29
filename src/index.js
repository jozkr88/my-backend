import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Router, useRoute, useLocation } from 'wouter';
import './styles.css';
import { App } from './App';
import backSvg from './back.svg';
import LoadingScreen from './LoadingScreen';
import { appBasePath } from './utils/paths';

const FREEZE_LOADING_SCREEN = false;

function Root() {
  const [, params] = useRoute('/neo/:id');
  const [, setLocation] = useLocation();

  // ✅ Escape key = back in history (or / if no history)
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        setLocation('/');
      }
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    window.setLocation = setLocation;
    window.navigate = setLocation;

    return () => {
      delete window.setLocation;
      delete window.navigate;
    };
  }, [setLocation]);

  const [loading, setLoading] = useState(true);
  const [canvasReady, setCanvasReady] = useState(false);
  const [minimumDelayDone, setMinimumDelayDone] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    const asyncLoadCanvas = async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      setCanvasReady(true);
    };

    const timer = setTimeout(() => {
      setMinimumDelayDone(true);
    }, 1000);

    asyncLoadCanvas();
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loading) {
      setLoadingProgress(100);
      return undefined;
    }

    setLoadingProgress((current) => {
      if (current > 0) return current;
      const cap = sceneReady && minimumDelayDone ? 99 : 92;
      return Math.min(8, cap);
    });

    const intervalId = window.setInterval(() => {
      setLoadingProgress((current) => {
        const cap = sceneReady && minimumDelayDone ? 99 : 92;
        if (current >= cap) return current;
        const increment = current < 40 ? 8 : current < 75 ? 4 : 1;
        return Math.min(current + increment, cap);
      });
    }, 180);

    return () => window.clearInterval(intervalId);
  }, [loading, minimumDelayDone, sceneReady]);

  useEffect(() => {
    if (!loading || !canvasReady || !minimumDelayDone || !sceneReady) {
      return undefined;
    }

    setLoadingProgress(100);
    setLoading(false);
    return undefined;
  }, [canvasReady, loading, minimumDelayDone, sceneReady]);

  useEffect(() => {
    if (!loading) {
      return undefined;
    }

    const failSafeTimer = window.setTimeout(() => {
      setLoadingProgress(100);
      setLoading(false);
    }, 7000);

    return () => window.clearTimeout(failSafeTimer);
  }, [loading]);

  return (
    <>
      <LoadingScreen
        progress={loadingProgress}
        visible={loading || FREEZE_LOADING_SCREEN}
        settled={!loading && !FREEZE_LOADING_SCREEN}
      />
      {canvasReady && (
        <div
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        >
          <App
            isInitialLoading={loading}
            onSceneReady={() => setSceneReady(true)}
          />

          {/* 🧭 Back button */}
          <button
            className="back-nav-button"
            style={{ visibility: params ? 'visible' : 'hidden' }}
            onClick={() => setLocation('/')}
          >
            <img src={backSvg} alt="Back" />
          </button>
        </div>
      )}
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <Router base={appBasePath}>
    <Root />
  </Router>
);
