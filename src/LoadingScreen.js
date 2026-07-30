import React, { useEffect, useMemo, useState } from "react";
import styled, { keyframes } from "styled-components";
import loadingSvg from "./preloader-loading.svg";
import loadingMobileSvg from "./preloader-loading-m.svg";
import m1Png from "./m1.png";
import toolsSvg from "./pill.webp";

const PRELOADER_COLORWAYS = [
  {
    screen:
      "radial-gradient(circle at 14% 18%, rgba(255, 88, 174, 0.42), transparent 34%), radial-gradient(circle at 84% 16%, rgba(255, 214, 64, 0.32), transparent 30%), radial-gradient(circle at 50% 74%, rgba(104, 180, 255, 0.22), transparent 40%), radial-gradient(circle at 36% 58%, rgba(180, 88, 255, 0.16), transparent 34%), linear-gradient(180deg, #09070d 0%, #100a15 50%, #0b0a10 100%)",
    scrim:
      "radial-gradient(circle at center, rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.44) 74%), linear-gradient(180deg, rgba(7, 4, 11, 0.18), rgba(6, 5, 8, 0.36))",
    wash:
      "linear-gradient(180deg, rgba(34, 18, 48, 0.18), rgba(10, 10, 16, 0.28)), radial-gradient(circle at 50% 48%, rgba(255, 255, 255, 0.06), rgba(255, 118, 194, 0.08) 34%, rgba(5, 5, 7, 0.08) 62%, transparent 78%)",
    blobs: [
      "radial-gradient(circle at 30% 30%, rgba(255, 225, 84, 0.58), rgba(255, 84, 189, 0.42) 48%, rgba(0, 0, 0, 0) 78%)",
      "radial-gradient(circle at 50% 50%, rgba(72, 184, 255, 0.56), rgba(170, 240, 255, 0.2) 42%, rgba(0, 0, 0, 0) 76%)",
      "radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.22), rgba(255, 214, 10, 0.18) 36%, rgba(255, 120, 66, 0.1) 56%, rgba(0, 0, 0, 0) 76%)",
      "radial-gradient(circle at 50% 50%, rgba(255, 92, 208, 0.36), rgba(255, 255, 255, 0.12) 46%, rgba(0, 0, 0, 0) 78%)",
      "radial-gradient(circle at 50% 50%, rgba(120, 110, 255, 0.3), rgba(255, 98, 182, 0.18) 40%, rgba(0, 0, 0, 0) 76%)",
    ],
  },
  {
    screen:
      "radial-gradient(circle at 18% 18%, rgba(72, 194, 255, 0.38), transparent 34%), radial-gradient(circle at 78% 14%, rgba(116, 255, 223, 0.3), transparent 28%), radial-gradient(circle at 52% 74%, rgba(255, 228, 102, 0.18), transparent 38%), radial-gradient(circle at 30% 62%, rgba(112, 126, 255, 0.2), transparent 34%), linear-gradient(180deg, #060a12 0%, #08111c 52%, #080d15 100%)",
    scrim:
      "radial-gradient(circle at center, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.46) 74%), linear-gradient(180deg, rgba(4, 8, 14, 0.16), rgba(5, 8, 12, 0.34))",
    wash:
      "linear-gradient(180deg, rgba(15, 34, 54, 0.16), rgba(8, 12, 18, 0.3)), radial-gradient(circle at 50% 46%, rgba(180, 245, 255, 0.08), rgba(85, 160, 255, 0.08) 36%, rgba(5, 8, 12, 0.08) 62%, transparent 78%)",
    blobs: [
      "radial-gradient(circle at 30% 30%, rgba(118, 245, 255, 0.52), rgba(59, 153, 255, 0.34) 48%, rgba(0, 0, 0, 0) 78%)",
      "radial-gradient(circle at 50% 50%, rgba(123, 255, 226, 0.52), rgba(197, 255, 246, 0.18) 42%, rgba(0, 0, 0, 0) 76%)",
      "radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.2), rgba(255, 227, 118, 0.2) 38%, rgba(111, 167, 255, 0.08) 58%, rgba(0, 0, 0, 0) 76%)",
      "radial-gradient(circle at 50% 50%, rgba(110, 140, 255, 0.34), rgba(255, 255, 255, 0.1) 44%, rgba(0, 0, 0, 0) 78%)",
      "radial-gradient(circle at 50% 50%, rgba(52, 219, 201, 0.28), rgba(88, 142, 255, 0.16) 40%, rgba(0, 0, 0, 0) 76%)",
    ],
  },
  {
    screen:
      "radial-gradient(circle at 12% 20%, rgba(255, 110, 86, 0.38), transparent 32%), radial-gradient(circle at 84% 20%, rgba(255, 176, 66, 0.34), transparent 30%), radial-gradient(circle at 50% 74%, rgba(255, 108, 171, 0.18), transparent 38%), radial-gradient(circle at 32% 62%, rgba(255, 88, 230, 0.18), transparent 34%), linear-gradient(180deg, #110805 0%, #1a0d08 50%, #120809 100%)",
    scrim:
      "radial-gradient(circle at center, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.44) 74%), linear-gradient(180deg, rgba(16, 8, 5, 0.16), rgba(10, 6, 6, 0.34))",
    wash:
      "linear-gradient(180deg, rgba(54, 20, 12, 0.16), rgba(18, 10, 10, 0.28)), radial-gradient(circle at 50% 48%, rgba(255, 234, 182, 0.07), rgba(255, 117, 93, 0.08) 34%, rgba(8, 6, 7, 0.08) 62%, transparent 78%)",
    blobs: [
      "radial-gradient(circle at 30% 30%, rgba(255, 176, 86, 0.54), rgba(255, 96, 102, 0.38) 48%, rgba(0, 0, 0, 0) 78%)",
      "radial-gradient(circle at 50% 50%, rgba(255, 214, 92, 0.46), rgba(255, 248, 198, 0.18) 42%, rgba(0, 0, 0, 0) 76%)",
      "radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.2), rgba(255, 130, 96, 0.18) 34%, rgba(255, 92, 180, 0.12) 58%, rgba(0, 0, 0, 0) 76%)",
      "radial-gradient(circle at 50% 50%, rgba(255, 98, 178, 0.34), rgba(255, 255, 255, 0.1) 44%, rgba(0, 0, 0, 0) 78%)",
      "radial-gradient(circle at 50% 50%, rgba(255, 140, 82, 0.3), rgba(255, 208, 90, 0.18) 40%, rgba(0, 0, 0, 0) 76%)",
    ],
  },
  {
    screen:
      "radial-gradient(circle at 14% 18%, rgba(174, 110, 255, 0.38), transparent 34%), radial-gradient(circle at 84% 18%, rgba(111, 144, 255, 0.3), transparent 30%), radial-gradient(circle at 50% 74%, rgba(255, 108, 208, 0.2), transparent 38%), radial-gradient(circle at 34% 60%, rgba(99, 226, 255, 0.16), transparent 34%), linear-gradient(180deg, #08070f 0%, #0f0a19 52%, #0a0912 100%)",
    scrim:
      "radial-gradient(circle at center, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.48) 74%), linear-gradient(180deg, rgba(8, 6, 16, 0.18), rgba(6, 5, 10, 0.36))",
    wash:
      "linear-gradient(180deg, rgba(28, 18, 58, 0.16), rgba(8, 8, 18, 0.28)), radial-gradient(circle at 50% 48%, rgba(214, 202, 255, 0.06), rgba(110, 108, 255, 0.08) 34%, rgba(5, 5, 8, 0.08) 62%, transparent 78%)",
    blobs: [
      "radial-gradient(circle at 30% 30%, rgba(196, 130, 255, 0.54), rgba(110, 100, 255, 0.34) 48%, rgba(0, 0, 0, 0) 78%)",
      "radial-gradient(circle at 50% 50%, rgba(108, 198, 255, 0.5), rgba(208, 236, 255, 0.16) 42%, rgba(0, 0, 0, 0) 76%)",
      "radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.2), rgba(255, 120, 208, 0.16) 36%, rgba(131, 100, 255, 0.1) 56%, rgba(0, 0, 0, 0) 76%)",
      "radial-gradient(circle at 50% 50%, rgba(255, 112, 216, 0.34), rgba(255, 255, 255, 0.1) 44%, rgba(0, 0, 0, 0) 78%)",
      "radial-gradient(circle at 50% 50%, rgba(112, 134, 255, 0.3), rgba(92, 222, 255, 0.18) 40%, rgba(0, 0, 0, 0) 76%)",
    ],
  },
];

const PRELOADER_BLOB_LAYOUTS = [
  [
    { left: -8, top: 10, leftJitter: 8, topJitter: 6 },
    { left: 64, top: 8, leftJitter: 8, topJitter: 6 },
    { left: 18, top: 54, leftJitter: 9, topJitter: 7 },
    { left: 30, top: 24, leftJitter: 8, topJitter: 6 },
    { left: 46, bottom: 6, leftJitter: 9, bottomJitter: 7 },
  ],
  [
    { left: -14, top: 18, leftJitter: 8, topJitter: 6 },
    { left: 72, top: 4, leftJitter: 8, topJitter: 6 },
    { left: 8, top: 62, leftJitter: 10, topJitter: 8 },
    { left: 42, top: 16, leftJitter: 8, topJitter: 6 },
    { left: 58, bottom: 12, leftJitter: 10, bottomJitter: 8 },
  ],
  [
    { left: -4, top: 6, leftJitter: 8, topJitter: 6 },
    { left: 58, top: 16, leftJitter: 8, topJitter: 6 },
    { left: 24, top: 58, leftJitter: 10, topJitter: 8 },
    { left: 18, top: 30, leftJitter: 8, topJitter: 6 },
    { left: 52, bottom: 0, leftJitter: 10, bottomJitter: 8 },
  ],
  [
    { left: -12, top: 12, leftJitter: 8, topJitter: 6 },
    { left: 68, top: 14, leftJitter: 8, topJitter: 6 },
    { left: 14, top: 48, leftJitter: 10, topJitter: 8 },
    { left: 36, top: 22, leftJitter: 8, topJitter: 6 },
    { left: 40, bottom: 2, leftJitter: 10, bottomJitter: 8 },
  ],
];

function jitterPercent(base, range) {
  return `${base + (Math.random() * 2 - 1) * range}%`;
}

const Screen = styled.div`
  position: fixed;
  inset: 0;
  z-index: 20000;
  width: 100%;
  height: 100%;
  background: #000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  pointer-events: ${({ $visible }) => ($visible ? "auto" : "none")};
  transition: opacity 0.16s linear;
`;

const BackgroundImage = styled.img`
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center center;
  pointer-events: none;
  user-select: none;
  image-rendering: auto;

  @media (max-width: 640px) {
    transform: scale(1.18);
    transform-origin: center center;
  }
`;

/* Shimmer animation for smooth side-to-side movement */
const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

/* Yellow pulse effect — brightens periodically */
const pulse = keyframes`
  0%, 100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.6) saturate(1.4);
  }
`;

const blurDrift = keyframes`
  0% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  35% {
    transform: translate3d(1.5rem, -1rem, 0) scale(1.04);
  }
  70% {
    transform: translate3d(-1rem, 1.35rem, 0) scale(0.98);
  }
  100% {
    transform: translate3d(0.75rem, -0.6rem, 0) scale(1.02);
  }
`;

const washShift = keyframes`
  0%, 100% {
    opacity: 0.92;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.02);
  }
`;

const BackdropScrim = styled.div`
  position: absolute;
  inset: 0;
  z-index: 3;
  background: transparent;
`;

const BlurField = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  overflow: hidden;
  opacity: 1;
`;

const BlurWash = styled.div`
  position: absolute;
  inset: 0;
  background: ${({ $background }) => $background};
  animation: ${washShift} 12s ease-in-out infinite;
  will-change: transform, opacity;
  opacity: 0.03;
`;

const BlurBlob = styled.div`
  position: absolute;
  width: ${({ $size }) => $size};
  height: ${({ $size }) => $size};
  left: ${({ $left }) => $left};
  top: ${({ $top }) => $top ?? "auto"};
  bottom: ${({ $bottom }) => $bottom ?? "auto"};
  border-radius: 50%;
  background: ${({ $gradient }) => $gradient};
  filter: blur(${({ $blur }) => $blur});
  opacity: ${({ $opacity }) => $opacity};
  mix-blend-mode: screen;
  animation: ${blurDrift} ${({ $duration = "16s" }) => $duration} ease-in-out infinite;
  animation-delay: ${({ $delay = "0s" }) => $delay};
  will-change: transform, opacity;
`;

const ToolsMark = styled.img`
  position: fixed;
  top: 20.4%;
  left: 50%;
  z-index: 4;
  width: min(78vw, 60vh, 780px);
  max-width: 100%;
  height: auto;
  display: block;
  transform: translate3d(-50%, -50%, 0);
  pointer-events: none;
  backface-visibility: hidden;
  image-rendering: auto;
  filter:
    drop-shadow(0 0 10px rgba(255, 255, 255, 0.08))
    drop-shadow(0 0 18px rgba(255, 255, 255, 0.06));

  @media (max-width: 640px) {
    top: 24%;
    width: min(130vw, 62vh, 900px);
  }

  @media (max-height: 600px) {
    display: none !important;
    visibility: hidden;
  }
`;

const LoadingMarkWrap = styled.div`
  width: min(122vw, 80vh, 820px);
  max-width: 100%;
  position: fixed;
  left: 50%;
  bottom: clamp(2rem, 4vh, 3.5rem);
  transform: translateX(-50%);
  z-index: 2;
  margin-top: 0;
  pointer-events: none;
  overflow: visible;
  isolation: isolate;

  @media (max-width: 640px) {
    width: min(89.6vw, 36.8vh, 416px);
  }

  @media (max-height: 600px) {
    display: none !important;
  }
`;

const LoadingMarkPicture = styled.picture`
  display: block;
  width: 100%;
  max-width: 100%;
`;

const LoadingMark = styled.img`
  width: 100%;
  max-width: 100%;
  height: auto;
  display: block;
  position: relative;
  z-index: 1;
  -webkit-transform: translateZ(0);
  transform: translateZ(0);

  @media (max-height: 600px) {
    display: none !important;
    visibility: hidden;
  }
`;

const LoaderBarWrapper = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 18px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 0 9px 9px 0;
  overflow: hidden;
  z-index: 5;
`;

const LoaderBarFill = styled.div`
  height: 100%;
  width: ${({ progress }) => progress}%;
  background: linear-gradient(
    120deg,
    rgba(218, 3, 17, 0.8) 0%,    /* red */
    rgba(235, 15, 193, 0.9) 25%, /* pink */
    rgba(233, 218, 13, 1) 50%,   /* yellow */
    rgba(235, 15, 193, 0.9) 75%, /* pink again */
    rgba(218, 3, 17, 0.8) 100%   /* red again */
  );
  background-size: 200% 100%;
  animation: ${shimmer} 2.5s linear infinite, ${pulse} 1.8s ease-in-out infinite;
  transition: width 0.3s ease-out;
  border-top-right-radius: 9px;
  border-bottom-right-radius: 9px;
`;

const LoadingScreen = ({ progress, visible, settled }) => {
  const [showArtwork, setShowArtwork] = useState(false);
  const colorway = useMemo(
    () => PRELOADER_COLORWAYS[Math.floor(Math.random() * PRELOADER_COLORWAYS.length)],
    []
  );
  const blobLayout = useMemo(
    () => {
      const preset =
        PRELOADER_BLOB_LAYOUTS[
          Math.floor(Math.random() * PRELOADER_BLOB_LAYOUTS.length)
        ];

      return preset.map((blob) => ({
        left: jitterPercent(blob.left, blob.leftJitter),
        top:
          typeof blob.top === "number"
            ? jitterPercent(blob.top, blob.topJitter)
            : undefined,
        bottom:
          typeof blob.bottom === "number"
            ? jitterPercent(blob.bottom, blob.bottomJitter)
            : undefined,
      }));
    },
    []
  );
  const rawProgress = Math.max(0, Math.min(100, progress || 0));
  const safeProgress = settled ? 100 : Math.min(rawProgress, 99);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setShowArtwork(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <Screen $visible={visible} $background={colorway.screen}>
      {showArtwork ? (
        <BackgroundImage
          src={m1Png}
          alt=""
          aria-hidden="true"
        />
      ) : null}

      <BlurField aria-hidden="true">
        <BlurBlob
          $size="min(42vw, 46vh, 520px)"
          $left={blobLayout[0].left}
          $top={blobLayout[0].top}
          $blur="80px"
          $opacity={0.05}
          $duration="18s"
          $delay="-4s"
          $gradient={colorway.blobs[0]}
        />
        <BlurBlob
          $size="min(38vw, 42vh, 460px)"
          $left={blobLayout[1].left}
          $top={blobLayout[1].top}
          $blur="88px"
          $opacity={0.038}
          $duration="21s"
          $delay="-8s"
          $gradient={colorway.blobs[1]}
        />
        <BlurBlob
          $size="min(54vw, 54vh, 680px)"
          $left={blobLayout[2].left}
          $top={blobLayout[2].top}
          $blur="110px"
          $opacity={0.024}
          $duration="24s"
          $delay="-11s"
          $gradient={colorway.blobs[2]}
        />
        <BlurBlob
          $size="min(44vw, 34vh, 420px)"
          $left={blobLayout[3].left}
          $top={blobLayout[3].top}
          $blur="92px"
          $opacity={0.028}
          $duration="19s"
          $delay="-6s"
          $gradient={colorway.blobs[3]}
        />
        <BlurBlob
          $size="min(48vw, 38vh, 460px)"
          $left={blobLayout[4].left}
          $bottom={blobLayout[4].bottom}
          $blur="100px"
          $opacity={0.017}
          $duration="22s"
          $delay="-9s"
          $gradient={colorway.blobs[4]}
        />
        <BlurWash $background={colorway.wash} />
      </BlurField>
      <BackdropScrim $background={colorway.scrim} />
      {showArtwork ? (
        <ToolsMark
          src={toolsSvg}
          alt=""
          draggable="false"
          aria-hidden="true"
        />
      ) : null}

      {showArtwork ? (
        <LoadingMarkWrap aria-hidden="true">
          <LoadingMarkPicture>
            <source media="(max-width: 640px)" srcSet={loadingMobileSvg} />
            <LoadingMark src={loadingSvg} alt="" draggable="false" />
          </LoadingMarkPicture>
        </LoadingMarkWrap>
      ) : null}

      {/* Animated progress bar */}
      <LoaderBarWrapper>
        <LoaderBarFill progress={safeProgress} />
      </LoaderBarWrapper>
    </Screen>
  );
};

export default LoadingScreen;
