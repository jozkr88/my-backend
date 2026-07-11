export const JOZ_LLM_LANES = {
  business_need: {
    intentMode: "business_need",
    label: "Business Value",
    title: "Business Value",
    summary:
      "Joz turns noisy systems into usable intelligence, faster decisions, and real operational lift.",
    highlights: [
      "AI tied to measurable outcomes",
      "Strong signal and decision thinking",
      "Clarity in noisy environments",
    ],
    retrievalCategories: ["business_need", "case_study", "proof", "bio", "faq"],
    actions: [
      {
        label: "Why hire Joz now?",
        prompt: "Why should a company hire Joz right now for an agentic AI and AI systems role?",
      },
      {
        label: "Where is the ROI?",
        prompt: "Where does Joz create the most business value and ROI in AI systems?",
      },
      {
        label: "What problems can Joz solve?",
        prompt: "What business and operational problems is Joz best positioned to solve?",
      },
    ],
  },
  mindset: {
    intentMode: "mindset",
    label: "Systems Mindset",
    title: "Systems Mindset",
    summary:
      "Joz thinks in systems. Joz finds signal, pressure-tests complexity, and drives toward clear action.",
    highlights: [
      "Signal over noise",
      "Operational truth over theory",
      "Clarity, trust, and action",
    ],
    retrievalCategories: ["mindset", "case_study", "proof", "bio", "faq"],
    actions: [
      {
        label: "How does Joz think?",
        prompt: "Explain how Joz thinks about intelligence, systems, and decision-making.",
      },
      {
        label: "How does Joz handle complexity?",
        prompt: "How does Joz reduce complexity without losing depth or rigor?",
      },
      {
        label: "What is Joz's operating mindset?",
        prompt: "What is Joz's operating mindset when building AI systems?",
      },
    ],
  },
  skills: {
    intentMode: "skills",
    label: "Joz's Skills",
    title: "Joz's Skills",
    summary:
      "Joz is strongest across agentic AI systems, orchestration, signal reasoning, and execution.",
    highlights: [
      "Agentic AI architecture and orchestration",
      "Signal reasoning and operational intelligence",
      "Python, SQL, and production delivery",
    ],
    retrievalCategories: ["skills", "case_study", "proof", "bio", "faq"],
    actions: [
      {
        label: "Show AI strengths",
        prompt: "Show Joz's strongest agentic AI systems and orchestration capabilities.",
      },
      {
        label: "Explain signal fit",
        prompt: "Why is Joz strong for signal reasoning, anomaly detection, and time-series problem solving?",
      },
      {
        label: "What can Joz build?",
        prompt: "What can Joz architect and build technically in an advanced AI environment?",
      },
    ],
  },
  booking: {
    intentMode: "booking",
    label: "Book Joz",
    title: "Meet Joz",
    summary: "Here is the fastest way to book time with Joz.",
    highlights: [
      "Advisory call",
      "Architecture review",
      "Hiring or project discussion",
    ],
    retrievalCategories: ["booking", "proof", "bio", "faq"],
    actions: [],
  },
};

export function normalizeJozLaneIntent(intentMode = "skills") {
  const normalized = String(intentMode || "skills").trim().toLowerCase();
  return JOZ_LLM_LANES[normalized] ? normalized : "skills";
}

export function getJozLaneConfig(intentMode = "skills") {
  return JOZ_LLM_LANES[normalizeJozLaneIntent(intentMode)];
}
