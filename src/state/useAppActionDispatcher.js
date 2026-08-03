import { useCallback } from "react";

import { APP_ACTIONS } from "./actionTypes";
import { recordWholeAppJourneyEvent } from "../world-model/appJourney.js";

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
      const recordAction = (action, target = null) => {
        void recordWholeAppJourneyEvent({
          action,
          target,
          source: "app_action_dispatcher",
          outcomeType: "action_accepted",
        }).catch((error) => {
          console.warn("⚠️ Whole-app journey recording failed:", error?.message || error);
        });
      };

      switch (type) {
        case APP_ACTIONS.SHOW_CONTACT:
          showContactCta(payload);
          recordAction("show_contact", "contact");
          return true;

        case APP_ACTIONS.HIDE_CONTACT:
          hideContactCta(payload.delayMs);
          recordAction("hide_contact", "contact");
          return true;

        case APP_ACTIONS.OPEN_BALL_PORTAL:
          handleBallPortalOpen?.();
          recordAction("open_ball_portal", "ball");
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
          recordAction("navigate", targetPath);
          return true;
        }

        case APP_ACTIONS.MEET_JOZ_FLEX:
          handleVibeClick?.();
          recordAction("meet_joz_vibe", "vibe");
          return true;

        case APP_ACTIONS.MEET_JOZ_DISCOVER:
          handleDiscoverClick?.();
          recordAction("meet_joz_discover", "discover");
          return true;

        case APP_ACTIONS.MEET_JOZ_SKILLS:
          handleSkillsClick?.();
          recordAction("meet_joz_skills", "skills");
          return true;

        case APP_ACTIONS.MEET_JOZ_BACK:
          handleBackClick?.();
          recordAction("meet_joz_back", "back");
          return true;

        case APP_ACTIONS.MEET_JOZ_BACK1:
          handleBack1Click?.();
          recordAction("meet_joz_back1", "back");
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
