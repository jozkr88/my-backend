import { useRef, useState } from "react";

export function useMeetJozRuntime() {
  const [showModel2, setShowModel2] = useState(false);
  const [showModel3, setShowModel3] = useState(false);
  const [world8Active, setWorld8Active] = useState(false);
  const [showMeetJozMetaballs, setShowMeetJozMetaballs] = useState(false);
  const [meetJozMetaballsProgress, setMeetJozMetaballsProgress] = useState(0);
  const [isMeetJozDiscoverActive, setIsMeetJozDiscoverActive] = useState(false);
  const [showMeetJozEnvBackground, setShowMeetJozEnvBackground] = useState(false);
  const [meetJozPortalBlend, setMeetJozPortalBlend] = useState(0);
  const [world8Opacity, setWorld8Opacity] = useState(null);
  const [worldxInDelay, setWorldxInDelay] = useState(0.9);
  const [showModel4, setShowModel4] = useState(false);
  const [isWorkStepInteractive, setIsWorkStepInteractive] = useState(false);
  const [meetJozReadableBackdrop, setMeetJozReadableBackdrop] = useState(false);
  const [modeForAurx, setModeForAurx] = useState("fadeOnly");
  const [triggerCount, setTriggerCount] = useState(0);
  const [aurxOutDelay, setAurxOutDelay] = useState(0);
  const [aurxPlaybackDelay, setAurxPlaybackDelay] = useState(0);
  const [forcedOpacity, setForcedOpacity] = useState(null);
  const [resetCounter, setResetCounter] = useState(0);

  const toggleJkxRef = useRef(null);
  const resumeFromSkills = useRef(null);
  const pauseFromBack1 = useRef(null);
  const pendingJkxOpenRef = useRef(false);

  return {
    showModel2,
    setShowModel2,
    showModel3,
    setShowModel3,
    world8Active,
    setWorld8Active,
    showMeetJozMetaballs,
    setShowMeetJozMetaballs,
    meetJozMetaballsProgress,
    setMeetJozMetaballsProgress,
    isMeetJozDiscoverActive,
    setIsMeetJozDiscoverActive,
    showMeetJozEnvBackground,
    setShowMeetJozEnvBackground,
    meetJozPortalBlend,
    setMeetJozPortalBlend,
    world8Opacity,
    setWorld8Opacity,
    worldxInDelay,
    setWorldxInDelay,
    showModel4,
    setShowModel4,
    isWorkStepInteractive,
    setIsWorkStepInteractive,
    meetJozReadableBackdrop,
    setMeetJozReadableBackdrop,
    modeForAurx,
    setModeForAurx,
    triggerCount,
    setTriggerCount,
    aurxOutDelay,
    setAurxOutDelay,
    aurxPlaybackDelay,
    setAurxPlaybackDelay,
    forcedOpacity,
    setForcedOpacity,
    resetCounter,
    setResetCounter,
    toggleJkxRef,
    resumeFromSkills,
    pauseFromBack1,
    pendingJkxOpenRef,
  };
}
