import { useCallback } from "react";

import { APP_ACTIONS } from "./actionTypes";

export function useAppActionDispatcher({
  announcePortalTransition,
  setLocation,
  handleBallPortalOpen,
  showContactCta,
  hideContactCta,
  setPendingMeetJozVoiceAction,
  pendingPortalActionRef,
  handleVibeClick,
  handleBackClick,
  handleDiscoverClick,
  handleBack1Click,
  handleSkillsClick,
}) {
  return useCallback(
    (type, payload = {}) => {
      switch (type) {
        case APP_ACTIONS.SHOW_CONTACT:
          showContactCta(payload);
          return true;

        case APP_ACTIONS.HIDE_CONTACT:
          hideContactCta(payload.delayMs);
          return true;

        case APP_ACTIONS.OPEN_BALL_PORTAL:
          handleBallPortalOpen?.();
          return true;

        case APP_ACTIONS.NAVIGATE: {
          const targetPath = String(payload.targetPath || "").trim();
          if (!targetPath.startsWith("/")) return false;

          const deferredAction = String(payload.deferredAction || "").trim();
          if (
            pendingPortalActionRef &&
            targetPath === "/neo/meet-joz" &&
            ["vibe", "discover", "skills"].includes(deferredAction)
          ) {
            pendingPortalActionRef.current = {
              action: deferredAction,
              runNuclearSkillsSequence: Boolean(payload.runNuclearSkillsSequence),
              requestedAt: Date.now(),
              sourcePortal:
                typeof window !== "undefined"
                  ? window.location.pathname
                  : "",
            };
            setPendingMeetJozVoiceAction?.(deferredAction);
          }

          announcePortalTransition(targetPath);
          setLocation(targetPath);
          return true;
        }

        case APP_ACTIONS.MEET_JOZ_FLEX:
          handleVibeClick?.();
          return true;

        case APP_ACTIONS.MEET_JOZ_DISCOVER:
          handleDiscoverClick?.();
          return true;

        case APP_ACTIONS.MEET_JOZ_SKILLS:
          handleSkillsClick?.();
          return true;

        case APP_ACTIONS.MEET_JOZ_BACK:
          handleBackClick?.();
          return true;

        case APP_ACTIONS.MEET_JOZ_BACK1:
          handleBack1Click?.();
          return true;

        default:
          return false;
      }
    },
    [
      announcePortalTransition,
      handleBallPortalOpen,
      handleBack1Click,
      handleBackClick,
      handleDiscoverClick,
      handleSkillsClick,
      handleVibeClick,
      hideContactCta,
      pendingPortalActionRef,
      setLocation,
      setPendingMeetJozVoiceAction,
      showContactCta,
    ]
  );
}
