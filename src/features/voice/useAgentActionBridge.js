import { useEffect } from "react";

import { resolveSemanticAppAction } from "../../state/resolveSemanticAppAction";

export function useAgentActionBridge({
  currentPortal,
  dispatchAppAction,
  forceMeetJozSkillsStateRef,
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    window.__agentTriggerAction = (action) => {
      const plan = resolveSemanticAppAction({
        action,
        currentPortal,
        currentMesh: window.__currentMesh,
        currentMeshStage: window.__currentMeshStage,
        meetJozSkillsReady: Boolean(window.__meetJozSkillsReady),
      });

      if (!plan) return false;

      if (plan.kind === "dispatch") {
        return dispatchAppAction?.(plan.type, plan.payload);
      }

      if (plan.kind === "controlled-helper") {
        window[`__${plan.helper}`]?.();
        return true;
      }

      if (plan.kind === "controlled-trigger") {
        window.__triggerControlledGLB?.(plan.value);
        return true;
      }

      if (plan.kind === "force-state" && plan.target === "skills") {
        forceMeetJozSkillsStateRef?.current?.();
        return true;
      }

      if (plan.kind === "ar") {
        if (plan.target === "n2x") {
          window.__triggerAR?.();
          return true;
        }
        if (plan.target === "workf") {
          window.__triggerAR_Extra?.();
          return true;
        }
      }

      return false;
    };

    return () => {
      delete window.__agentTriggerAction;
    };
  }, [
    currentPortal,
    dispatchAppAction,
    forceMeetJozSkillsStateRef,
  ]);
}
