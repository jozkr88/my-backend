import { useCallback, useEffect, useRef, useState } from "react";

export function useVoiceHudStatus({ currentPortal, lastPortalRef }) {
  const [agentAwarenessLine, setAgentAwarenessLine] = useState("");
  const [voiceStatusLine, setVoiceStatusLine] = useState("");
  const agentAwarenessTimeoutRef = useRef(null);
  const pendingPortalKeyRef = useRef(null);
  const statusClearTimeoutRef = useRef(null);

  const announcePortalTransition = useCallback(
    (targetPath) => {
      const path = String(targetPath || "").trim();
      if (!path.startsWith("/")) return;

      let nextPortalKey = null;
      let nextLine = "";

      if (path === "/neo/maxx") {
        nextPortalKey = "maxx";
        nextLine = "Entering the Brain…";
      } else if (path === "/neo/meet-joz") {
        nextPortalKey = "meet-joz";
        nextLine = "Entering Meet Joz…";
      } else if (path === "/") {
        nextPortalKey = "root";
        nextLine = "Returning…";
        if (currentPortal !== "root") {
          lastPortalRef.current = currentPortal;
        }
      }

      if (!nextPortalKey || !nextLine) return;

      pendingPortalKeyRef.current = nextPortalKey;
      setVoiceStatusLine(nextLine);

      if (statusClearTimeoutRef.current) {
        window.clearTimeout(statusClearTimeoutRef.current);
      }

      statusClearTimeoutRef.current = window.setTimeout(() => {
        pendingPortalKeyRef.current = null;
        setVoiceStatusLine("");
        statusClearTimeoutRef.current = null;
      }, 2000);
    },
    [currentPortal, lastPortalRef]
  );

  useEffect(() => {
    if (!pendingPortalKeyRef.current) return;
    if (pendingPortalKeyRef.current !== currentPortal) return;

    if (statusClearTimeoutRef.current) {
      window.clearTimeout(statusClearTimeoutRef.current);
      statusClearTimeoutRef.current = null;
    }

    statusClearTimeoutRef.current = window.setTimeout(() => {
      pendingPortalKeyRef.current = null;
      setVoiceStatusLine("");
      statusClearTimeoutRef.current = null;
    }, 1600);
  }, [currentPortal]);

  useEffect(() => {
    return () => {
      if (statusClearTimeoutRef.current) {
        window.clearTimeout(statusClearTimeoutRef.current);
        statusClearTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const pushAwareness = (line) => {
      const next = String(line || "").trim();
      if (!next) return;

      setAgentAwarenessLine(next);
      if (agentAwarenessTimeoutRef.current) {
        window.clearTimeout(agentAwarenessTimeoutRef.current);
      }
      agentAwarenessTimeoutRef.current = window.setTimeout(() => {
        setAgentAwarenessLine("");
        agentAwarenessTimeoutRef.current = null;
      }, 7000);
    };

    window.__aiSay = pushAwareness;
    return () => {
      if (agentAwarenessTimeoutRef.current) {
        window.clearTimeout(agentAwarenessTimeoutRef.current);
        agentAwarenessTimeoutRef.current = null;
      }
      if (window.__aiSay === pushAwareness) {
        delete window.__aiSay;
      }
    };
  }, []);

  return {
    agentAwarenessLine,
    setAgentAwarenessLine,
    voiceStatusLine,
    setVoiceStatusLine,
    announcePortalTransition,
  };
}
