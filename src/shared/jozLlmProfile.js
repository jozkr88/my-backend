export const JOZ_LLM_IDENTITY = {
  name: "Jozef Krupa",
  label: "Joz LLM",
  website: "https://meetjoz.com",
  email: "joz@meetjoz.com",
  phone: "+421 952 538 970",
  location: "Bratislava, Slovakia / Singapore / Dubai / Zurich",
};

export const JOZ_LLM_CV = {
  headline:
    "Agentic AI architect and applied AI product leader with global experience across finance, insurance, media, public-sector innovation, spatial computing, and intelligent interfaces.",
  globalScale: [
    "North America",
    "Europe/EEA",
    "United Kingdom",
    "UAE/MENA",
    "Singapore",
    "Japan",
    "Greater China",
    "Australia",
    "Wider Asia Pacific",
  ],
  appliedAiSkills: {
    architecture: [
      "Agentic intelligence systems",
      "Autonomous reasoning and orchestration",
      "LLMs, RAG, embeddings, vector search, knowledge graphs",
      "Context engineering and memory architectures",
      "Retrieval systems, ACL-aware access, verification loops",
      "Event-driven production AI workflows",
      "Secure API ecosystems and cloud-native platforms",
      "Observability and AI governance",
    ],
    orchestration: [
      "Context-aware multimodal interaction",
      "Voice, touch, gesture, gaze, and haptics",
      "Telemetry-driven feedback loops",
      "Real-time behavioral signals",
      "Volumetric and spatial AI interfaces",
      "NLP/CV-driven personalization",
      "Intent modeling and semantic retrieval",
      "Predictive and assistive decision intelligence",
    ],
    dataScience: [
      "Classical ML framing and model selection",
      "Anomaly detection and predictive decision logic",
      "Time-series reasoning and continuous-signal interpretation",
      "Python-led product prototyping",
      "SQL/data-platform fluency in enterprise environments",
      "Applied experimentation and model-informed UX",
    ],
  },
  experience: [
    {
      title: "Agentic AI Architecture and Innovation Leader",
      period: "2018-Present",
      regions: "Singapore, Dubai, Zurich and Europe/EU/EEA",
      highlights: [
        "Architected financial AI agents with live data and portfolio intelligence for MarketClue USA.",
        "Pioneered spatial AI exhibition systems for ArtKorero in Dubai.",
        "Designed and launched volumetric spatial AI for Versace/SOA in Dubai.",
        "Rapid-prototyped AI initiatives for Dubai Future Foundation.",
        "Drove engineering and accessibility transformation at Erste Bank, serving 16M+ customers.",
        "Led HCD-AI, product, and data architectures across 20+ Dubai and Singapore fintechs.",
        "Pioneered Python USD(z) and computer vision AI workflows in Singapore with Apple/Pixar-adjacent work.",
      ],
    },
    {
      title: "Private Banking Experience Architecture Manager",
      period: "2016-2018",
      regions: "Maybank-Ageas Etiqa, Singapore and Asia Pacific",
      highlights: [
        "Delivered 20x growth in digital sales within 12 months via conversational and ML-led UX.",
        "Designed 3,000+ wealth pilots and ML models for HNW and mass-market clients.",
        "Established HCD-AI practice and trained C-suite executives and regional teams.",
      ],
    },
    {
      title: "Engineering Innovation Fellow",
      period: "2015-2016",
      regions: "Manulife, Singapore and Asia Pacific",
      highlights: [
        "Established Lean ML UX practice across 11 markets as a founding APAC hire.",
        "Launched ML-led solutions in the USA, Canada, and Singapore.",
        "Advised APAC regional CEOs on scalable digital growth strategy.",
      ],
    },
    {
      title: "Global Engineering Architect",
      period: "2014-2015",
      regions: "Mediacorp, Singapore and Asia Pacific",
      highlights: [
        "Shipped the CNA Apple Watch app, globally featured by Apple.",
        "Achieved 30x MAU audience growth through mobile-first transformation.",
        "Built a global experience language across 30+ products.",
      ],
    },
  ],
  education: [
    "MSc Strategy and Innovation, University of Lancashire",
    "Innovation Strategist (University Appointment), University of Lancashire",
    "MIT/IDEO Design Thinking",
    "HPI d.school prototyping labs",
  ],
};

export const TARGET_DATA_SCIENTIST_ROLE = {
  company: null,
  title: "Advanced Data Scientist",
  location: "Industrial / regulated environment",
  mission:
    "Turn complex operational data into actionable insights through AI/ML, predictive monitoring, and AI-enabled digital twins.",
  responsibilities: [
    "Build and deploy AI/ML models for forecasting, anomaly detection, and process optimization.",
    "Write packaged, versioned, testable Python code with CI/CD and production observability.",
    "Work with continuous datasets, time-series analysis, and signal processing.",
    "Collaborate with engineers, scientists, operators, and IT.",
    "Create dashboards and visualizations for technical and non-technical stakeholders.",
  ],
  requirements: [
    "Classical ML including KNN, SVM, Random Forest, and GBMs",
    "Deep learning including CNNs, RNNs, GRU, autoencoders",
    "Time-series and signal processing on noisy, high-dimensional data",
    "Python and SQL proficiency",
    "Databricks, MLflow, AWS, or adjacent MLOps exposure",
    "Strong communication of technical insights",
  ],
};

export const JOZ_LLM_SUGGESTIONS = [
  "Why is Joz a fit for this role?",
  "Map Joz to the job description",
  "Show evidence for time-series and ML",
  "How would Joz design anomaly detection for industrial data?",
  "What would Joz do in the first 90 days?",
];

export function buildJozLlmSystemPrompt() {
  return [
    "You are Joz LLM, an elite role-aware hiring agent representing Jozef Krupa.",
    "Your job is to translate Joz's real background into precise, evidence-based answers for an advanced data-science role focused on operational data, anomaly detection, predictive monitoring, and digital twins.",
    "Write in first person when speaking about Joz's work, but stay factual and specific.",
    "Keep responses short and punchy by default.",
    "Prefer one tight paragraph or at most 3 concise bullets unless more depth is explicitly asked for.",
    "Default to 2 to 4 short sentences total.",
    "Lead with the answer, not setup or framing.",
    "Do not invent employers, degrees, models shipped, or production claims beyond the provided profile.",
    "When there is a gap, position it honestly as adjacent strength plus a concrete ramp plan.",
    "Bias toward applied AI, data science, time-series, anomaly detection, MLOps, production engineering, and measurable impact.",
    "Avoid generic motivational language and avoid sounding like a chatbot.",
  ].join(" ");
}

export function buildJozLlmContext() {
  return {
    identity: JOZ_LLM_IDENTITY,
    cv: JOZ_LLM_CV,
    targetRole: TARGET_DATA_SCIENTIST_ROLE,
  };
}

export function buildJozLlmFallbackReply(message = "") {
  const clean = String(message || "").trim().toLowerCase();

  if (
    clean.includes("fit") ||
    clean.includes("match") ||
    clean.includes("why")
  ) {
    return [
      "Joz is a strong fit for applied AI that has to work in real environments.",
      "His edge is agentic systems, anomaly thinking, signal interpretation, Python-led delivery, and production-minded AI architecture.",
      "He is strongest where ambiguity is high and the system still needs to ship.",
    ].join("\n\n");
  }

  if (
    clean.includes("time-series") ||
    clean.includes("timeseries") ||
    clean.includes("signal") ||
    clean.includes("anomaly")
  ) {
    return [
      "Joz is strongest in structured intelligence over continuous signals, not generic chat AI.",
      "That maps well to time-series reasoning, anomaly detection, and process-state interpretation.",
      "The practical pipeline is normalization, drift-aware baselines, anomaly scoring, explainability, and retraining loops.",
    ].join("\n\n");
  }

  if (
    clean.includes("90 days") ||
    clean.includes("first 90") ||
    clean.includes("ramp")
  ) {
    return [
      "First 30 days: map data, stakeholders, bottlenecks, and the stack.",
      "By day 60: define one anomaly or predictive-monitoring use case with metrics.",
      "By day 90: ship one monitored pilot with a retraining path.",
    ].join("\n\n");
  }

  if (
    clean.includes("digital twin") ||
    clean.includes("industrial") ||
    clean.includes("process")
  ) {
    return [
      "A digital twin should be a decision layer, not just a visual layer.",
      "It should combine process state, anomaly signals, forecasts, and model confidence.",
      "The value is faster diagnosis and clearer action.",
    ].join("\n\n");
  }

  return [
    "I can explain Joz's fit, show AI evidence, and outline how he would approach anomaly detection, time-series monitoring, and digital twins.",
    "Try: Why is Joz a fit? Show time-series evidence. What would he do in the first 90 days?",
  ].join("\n\n");
}
