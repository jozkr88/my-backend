import { getAllowedActionsForPortal, getMeetJozVoiceLayer } from "../../world-model/meetJoz";
import {
  BLOCKED_GLB_FALLBACK_ACTIONS,
  normalizeVoiceAction,
} from "../../shared/voiceActions";
import { APP_ACTIONS } from "../../state/actionTypes";
import { resolveSemanticAppAction } from "../../state/resolveSemanticAppAction";

function formatVoiceSeconds(startedAt) {
  if (!startedAt) return "0.00";
  return ((performance.now() - startedAt) / 1000).toFixed(2);
}

export function applyVoiceReasoningResult({
  result,
  spoken,
  startedAt,
  source = "local",
  currentPortal,
  currentMesh,
  currentMeshStage,
  announcePortalTransition,
  setLocation,
  showContactCta,
  hideContactCta,
  setPendingMeetJozVoiceAction,
  dispatchAppAction,
  handleSkillsClick,
  pendingPortalActionRef,
  isWorkStepVisible = false,
  isWorkStepActive = false,
}) {
  const { action, target, awareness, timing, prediction } = result || {};

  if (typeof window !== "undefined" && prediction?.trajectoryId && prediction?.mode === "shadow") {
    window.__lastWorldPrediction = {
      ...prediction,
      recordedAt: new Date().toISOString(),
      observedState: null,
      predictionError: null,
    };
  }

  console.log("🎯 Reasoning result:", { action, target, awareness, timing, source, prediction });
  if (awareness) {
    window.__aiSay?.(awareness);
  }
  if (timing) {
    console.log(
      `⏱️ Voice timing result (${spoken}): total=${formatVoiceSeconds(
        startedAt
      )}s, backend=${timing?.backendSeconds ?? "n/a"}s`
    );
  } else {
    console.log(
      `⏱️ Voice timing result (${spoken}): total=${formatVoiceSeconds(
        startedAt
      )}s, backend=local`
    );
  }

  const safeTarget =
    typeof target === "string" &&
    (target.startsWith("/") ||
      target.startsWith("mailto:") ||
      target.startsWith("tel:"))
      ? target
      : null;
  const fallbackMailto =
    "mailto:joz@meetjoz.com";
  const fallbackTel = "tel:+41764973894";
  const runAppAction = (type, payload = {}, fallback) => {
    const handled = dispatchAppAction?.(type, payload);
    if (handled) return true;
    fallback?.();
    return Boolean(fallback);
  };
  const navigateTo = ({
    targetPath,
    deferredAction = "",
    runNuclearSkillsSequence = false,
  }) =>
    runAppAction(
      APP_ACTIONS.NAVIGATE,
      {
        targetPath,
        deferredAction,
        runNuclearSkillsSequence,
      },
      () => {
        if (
          pendingPortalActionRef &&
          targetPath === "/neo/meet-joz" &&
          ["vibe", "discover", "skills"].includes(deferredAction)
        ) {
          pendingPortalActionRef.current = {
            action: deferredAction,
            runNuclearSkillsSequence,
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
      }
    );

  if (action === "hide_contact_buttons") {
    console.log("🧹 Hiding contact buttons via reasoning");
    runAppAction(APP_ACTIONS.HIDE_CONTACT, {}, () => hideContactCta());
    return;
  }

  if (action === "show_contact_buttons") {
    console.log("✨ Showing contact buttons via reasoning");
    runAppAction(APP_ACTIONS.SHOW_CONTACT, {}, () => showContactCta());
    return;
  }

  if (action === "contact_joz" && !safeTarget) {
    console.log("📧 Using fallback email contact for Joz");
    const payload = {
      text: "Email Joz directly.",
      type: "email",
      href: fallbackMailto,
      label: "Open Mail App",
    };
    runAppAction(APP_ACTIONS.SHOW_CONTACT, payload, () => showContactCta(payload));
    return;
  }

  if (action === "call_joz" && !safeTarget) {
    console.log("📞 Using fallback call contact for Joz");
    const payload = {
      text: "Call Joz directly.",
      type: "call",
      href: fallbackTel,
      label: "Call Joz",
    };
    runAppAction(APP_ACTIONS.SHOW_CONTACT, payload, () => showContactCta(payload));
    return;
  }

  if (safeTarget?.startsWith("mailto:")) {
    console.log("📧 Preparing email contact for Joz");
    const payload = {
      text: "Email Joz directly.",
      type: "email",
      href: safeTarget,
      label: "Open Mail App",
    };
    runAppAction(APP_ACTIONS.SHOW_CONTACT, payload, () => showContactCta(payload));
    return;
  }

  if (safeTarget?.startsWith("tel:")) {
    console.log("📞 Preparing call contact for Joz");
    const payload = {
      text: "Call Joz directly.",
      type: "call",
      href: safeTarget,
      label: "Call Joz",
    };
    runAppAction(APP_ACTIONS.SHOW_CONTACT, payload, () => showContactCta(payload));
    return;
  }

  if (safeTarget?.startsWith("/")) {
    const deferredAction =
      normalizeVoiceAction(action) || String(action || "").toLowerCase().trim();

    const runNuclearSkillsSequence =
      deferredAction === "skills" &&
      (/going nuclear to skills/i.test(String(awareness || "")) ||
        currentPortal !== "meet-joz");

    navigateTo({
      targetPath: safeTarget,
      deferredAction,
      runNuclearSkillsSequence,
    });
    console.log("🚀 Navigating to", safeTarget);
    return;
  }

  if (target && !safeTarget) {
    console.warn("⚠️ Ignoring unsafe reasoning target:", target);
  }

  if (action) {
    console.log("🎬 Triggering GLB or AR:", action);
    const normalizedAction = normalizeVoiceAction(action) || action;

    const semanticPlan = resolveSemanticAppAction({
      action: normalizedAction,
      currentPortal,
      currentMesh,
      currentMeshStage,
      meetJozSkillsReady: isWorkStepVisible || isWorkStepActive,
    });

    if (semanticPlan?.kind === "dispatch") {
      runAppAction(semanticPlan.type, semanticPlan.payload);
      return;
    }

    if (semanticPlan?.kind === "controlled-helper") {
      window[`__${semanticPlan.helper}`]?.();
      return;
    }

    if (semanticPlan?.kind === "controlled-trigger") {
      window.__triggerControlledGLB?.(semanticPlan.value);
      return;
    }

    if (semanticPlan?.kind === "force-state" && semanticPlan.target === "skills") {
      runAppAction(APP_ACTIONS.MEET_JOZ_SKILLS, {}, () => handleSkillsClick?.());
      return;
    }

    if (semanticPlan?.kind === "ar") {
      if (semanticPlan.target === "n2x") {
        console.log("🚀 Launching AR for the brain scene (maxx)");
        window.__triggerAR?.();
        return;
      }

      if (semanticPlan.target === "workf") {
        console.log("🚀 Launching AR for jkx twin (meet-joz)");
        window.__triggerAR_Extra?.();
        return;
      }
    }

    if (window.__agentTriggerAction?.(normalizedAction)) {
      console.log("🧭 Voice action handled by agent trigger:", normalizedAction);
      return;
    }

    const portal = currentPortal === "meet-joz";
    const mesh = portal
      ? getMeetJozVoiceLayer(currentMesh, currentMeshStage) || ""
      : String(currentMesh || "").toLowerCase();

    if (portal) {
      const allowed = new Set(
        getAllowedActionsForPortal(currentPortal, currentMesh, currentMeshStage)
      );
      if (allowed.size && !allowed.has(normalizedAction)) {
        console.warn("🛡️ Frontend blocked invalid meet-joz transition:", {
          mesh,
          normalizedAction,
        });
        if (awareness) {
          console.log("ℹ️ Reasoning awareness:", awareness);
        }
        return;
      }
    }

    if (portal && mesh === "vibe" && normalizedAction === "vibe_back") {
      console.log("🚪 Voice → Exit meet-joz from Vibe (root)");
      navigateTo({ targetPath: "/" });
      return;
    }

    const [model, act] = normalizedAction.split("_");
    const handledByVoiceModel = Boolean(
      model &&
        act &&
        window.__voiceModelRegistry?.[model]
    );
    window.__voiceModelRegistry?.[model]?.(act);

    if (handledByVoiceModel) {
      return;
    }

    if (BLOCKED_GLB_FALLBACK_ACTIONS.has(normalizedAction)) {
      console.warn("🛡️ Blocked semantic action from GLB fallback:", {
        normalizedAction,
        currentPortal,
        currentMesh,
        currentMeshStage,
      });
      return;
    }

    window.__triggerControlledGLB?.(normalizedAction);
    return;
  }

  if (awareness) {
    console.log("ℹ️ Reasoning awareness:", awareness);
  } else {
    console.log("ℹ️ No-op reasoning result.");
  }
}
