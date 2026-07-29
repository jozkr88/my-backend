if (typeof window !== "undefined") {
  window.__voiceModelRegistry = window.__voiceModelRegistry || {};

  if (typeof window.__triggerVoiceModel !== "function") {
    window.__triggerVoiceModel = (name, action) => {
      const handler = window.__voiceModelRegistry?.[name];
      if (typeof handler === "function") {
        console.log(`🎬 [Voice] Triggering model "${name}" → ${action}`);
        handler(action);
      } else {
        console.warn(`⚠️ [Voice] No handler registered for: ${name}`);
      }
    };
  }
}
