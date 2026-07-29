import { useEffect } from "react";

export function useMaxxVoiceRegistry({
  enabled = true,
  actions,
  onPause,
  onResume,
  logPrefix = "[VoiceModel]",
  registerMessage = "Registered n2x voice handler",
  unregisterMessage = "Unregistered n2x voice handler",
}) {
  useEffect(() => {
    if (!enabled || !actions) return undefined;

    const pauseModel = () => {
      Object.values(actions).forEach((action) => {
        if (!action) return;
        action.paused = true;
      });
      onPause?.();
    };

    const resumeModel = () => {
      Object.values(actions).forEach((action) => {
        if (!action) return;
        action.paused = false;
        if (!action.isRunning()) action.play();
      });
      onResume?.();
    };

    const handler = (action) => {
      console.log(`🎬 ${logPrefix} n2x.glb → ${action}`);
      if (/(pause|stop|toggle)/i.test(action)) pauseModel();
      if (/(resume|play|continue|start)/i.test(action)) resumeModel();
    };

    window.__voiceModelRegistry = window.__voiceModelRegistry || {};
    window.__voiceModelRegistry.n2x = handler;
    console.log(`🎧 ${registerMessage}`);

    return () => {
      if (window.__voiceModelRegistry) {
        delete window.__voiceModelRegistry.n2x;
      }
      console.log(`🧹 ${unregisterMessage}`);
    };
  }, [
    actions,
    enabled,
    logPrefix,
    onPause,
    onResume,
    registerMessage,
    unregisterMessage,
  ]);
}
