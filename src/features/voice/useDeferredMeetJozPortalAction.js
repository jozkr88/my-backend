import { useEffect } from "react";

import { getCrossJumpSequence } from "./crossJumping";

const noop = () => {};

export function useDeferredMeetJozPortalAction({
  currentPortal,
  pendingPortalActionRef,
  setPendingMeetJozVoiceAction,
  meetJozVoiceReady,
  setMeetJozVoiceReady = noop,
  pendingMeetJozVoiceAction,
  forceMeetJozVibeStateRef,
  forceMeetJozDiscoverStateRef,
  forceMeetJozSkillsStateRef,
}) {
  const STALE_INTENT_MS = 8000;
  const updateMeetJozVoiceReady =
    typeof setMeetJozVoiceReady === "function" ? setMeetJozVoiceReady : noop;

  useEffect(() => {
    if (!pendingPortalActionRef.current) return;
    if (currentPortal !== "meet-joz") return;
    if (!meetJozVoiceReady) return;

    const { action, requestedAt, sourcePortal } = pendingPortalActionRef.current;
    let clearPendingHandle = null;
    let sequenceHandle = null;
    let sequenceRetryHandle = null;
    const clearPendingAction = () => {
      pendingPortalActionRef.current = null;
      clearPendingHandle = window.setTimeout(() => {
        setPendingMeetJozVoiceAction("");
      }, 900);
    };

    if (requestedAt && Date.now() - requestedAt > STALE_INTENT_MS) {
      console.warn("⚠️ Dropping stale deferred Meet Joz intent:", {
        action,
        requestedAt,
      });
      clearPendingAction();
      return () => {
        if (clearPendingHandle) {
          window.clearTimeout(clearPendingHandle);
        }
      };
    }

    console.log("🌀 Running deferred portal action:", action, "ready");

    const sequence = getCrossJumpSequence({
      sourcePortal,
      targetPortal: currentPortal,
      action,
      deferredNavigation: true,
    });

    if (sequence) {
      const triggerSequence = (attempt = 0) => {
        const triggered = window.__triggerControlledGLBSequence?.(sequence);
        if (triggered) {
          clearPendingAction();
          return;
        }

        if (attempt < 20) {
          sequenceRetryHandle = window.setTimeout(
            () => triggerSequence(attempt + 1),
            100
          );
          return;
        }

        console.warn("⚠️ Cross-jump sequence timed out:", {
          sourcePortal,
          targetPortal: currentPortal,
          action,
          sequence,
        });
        clearPendingAction();
      };

      const prepareCrossJump = (attempt = 0) => {
        const prepared = window.__prepareControlledGLBEntry?.("vibe");
        if (!prepared) {
          if (attempt < 20) {
            sequenceRetryHandle = window.setTimeout(
              () => prepareCrossJump(attempt + 1),
              100
            );
            return;
          }

          console.warn("⚠️ Cross-jump timed out waiting for ControlledGLB:", {
            sourcePortal,
            targetPortal: currentPortal,
            action,
            sequence,
          });
          clearPendingAction();
          return;
        }

        sequenceHandle = window.setTimeout(() => {
          triggerSequence();
        }, 120);
      };

      prepareCrossJump();

      return () => {
        if (sequenceHandle) {
          window.clearTimeout(sequenceHandle);
        }
        if (sequenceRetryHandle) {
          window.clearTimeout(sequenceRetryHandle);
        }
        if (clearPendingHandle) {
          window.clearTimeout(clearPendingHandle);
        }
      };
    }

    if (action === "skills") {
      forceMeetJozSkillsStateRef?.current?.();
      clearPendingAction();
      return () => {
        if (clearPendingHandle) {
          window.clearTimeout(clearPendingHandle);
        }
      };
    }

    return () => {
      if (sequenceHandle) {
        window.clearTimeout(sequenceHandle);
      }
      if (sequenceRetryHandle) {
        window.clearTimeout(sequenceRetryHandle);
      }
      if (clearPendingHandle) {
        window.clearTimeout(clearPendingHandle);
      }
    };
  }, [
    currentPortal,
    forceMeetJozDiscoverStateRef,
    forceMeetJozSkillsStateRef,
    forceMeetJozVibeStateRef,
    meetJozVoiceReady,
    pendingMeetJozVoiceAction,
    pendingPortalActionRef,
    updateMeetJozVoiceReady,
    setPendingMeetJozVoiceAction,
  ]);

  useEffect(() => {
    if (currentPortal === "meet-joz") return;
    if (!pendingMeetJozVoiceAction) return;
    setPendingMeetJozVoiceAction("");
  }, [currentPortal, pendingMeetJozVoiceAction, setPendingMeetJozVoiceAction]);

  useEffect(() => {
    if (currentPortal === "meet-joz") return;
    if (!meetJozVoiceReady) return;
    updateMeetJozVoiceReady(false);
  }, [currentPortal, meetJozVoiceReady, updateMeetJozVoiceReady]);

}
