WITH primary_profile AS (
  SELECT id
  FROM joz_profiles
  WHERE slug = 'jozef-krupa'
  LIMIT 1
)
INSERT INTO joz_profile_capabilities (
  profile_id,
  capability_type,
  capability_key,
  label,
  description,
  sort_order
)
SELECT
  primary_profile.id,
  seed.capability_type,
  seed.capability_key,
  seed.label,
  seed.description,
  seed.sort_order
FROM primary_profile
CROSS JOIN (
  VALUES
    ('button_lane', 'business_need', 'Business Need', 'Structures ambiguous business requests into clear AI, product, and systems opportunities.', 10),
    ('button_lane', 'mindset', 'Mindset', 'Explains how Joz thinks about systems, product, intelligence, and execution quality.', 20),
    ('button_lane', 'skills', 'Skills', 'Surfaces technical, strategic, and applied AI capabilities with evidence.', 30),
    ('button_lane', 'booking', 'Book Joz', 'Converts interest into a clear next engagement step.', 40),
    ('core_skill', 'agentic_ai', 'Agentic AI', 'Designs context-aware systems that reason, retrieve, route, and act.', 100),
    ('core_skill', 'computer_vision', 'Computer Vision', 'Applies vision-led thinking to multimodal interfaces and perception systems.', 110),
    ('core_skill', 'time_series', 'Time-series and anomaly reasoning', 'Frames noisy continuous signals into detectable patterns, alerts, and decisions.', 120),
    ('core_skill', 'ml_systems', 'Production AI systems', 'Moves AI from concept into deployed workflows, observability, and measurable value.', 130)
) AS seed(capability_type, capability_key, label, description, sort_order)
ON CONFLICT (profile_id, capability_type, capability_key)
DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

WITH primary_profile AS (
  SELECT id
  FROM joz_profiles
  WHERE slug = 'jozef-krupa'
  LIMIT 1
)
INSERT INTO joz_documents (
  profile_id,
  slug,
  title,
  category,
  source_type,
  summary,
  body,
  metadata
)
SELECT
  primary_profile.id,
  seed.slug,
  seed.title,
  seed.category,
  'manual',
  seed.summary,
  seed.body,
  seed.metadata::jsonb
FROM primary_profile
CROSS JOIN (
  VALUES
    (
      'business-need-overview',
      'Business Need Overview',
      'business_need',
      'How Joz reframes a business request into a system, delivery path, and measurable value.',
      'Joz starts by reducing ambiguity. He looks for the real problem underneath the language a business uses, identifies the signal that matters, then maps that signal into a system that can be built, measured, and iterated.\n\nThe value of this lane is not generic consulting language. It is the ability to turn loose intent into a concrete opportunity shape: what needs to be sensed, what needs to be predicted, what workflow needs to change, and what business outcome should improve.\n\nA strong Joz LLM business response should make the user feel that their vague need has been translated into architecture, delivery logic, and commercial relevance.',
      '{"lane":"business_need","response_shape":["problem","signal","system","approach","outcome"]}'
    ),
    (
      'business-need-delivery-shape',
      'Business Need Delivery Shape',
      'business_need',
      'The default way Joz would structure an applied AI or intelligent product engagement.',
      'A typical Joz delivery pattern is: diagnose the problem, map signals and constraints, define the intelligent system shape, prototype quickly, validate with stakeholders, and productionize only what creates operational value.\n\nThat means the answer should rarely jump straight into tools or models. It should first explain what decision or bottleneck matters, then outline how data, interaction, and orchestration support the solution.\n\nThis is where Joz LLM should distinguish itself from a generic chatbot: it should convert demand into system thinking and next steps.',
      '{"lane":"business_need","tags":["delivery","architecture","consulting"]}'
    ),
    (
      'mindset-principles',
      'Mindset Principles',
      'mindset',
      'How Joz thinks about product, intelligence, engineering quality, and interaction.',
      'Joz thinks in systems, not isolated screens or isolated models. He treats frontend, backend, interaction, data, and intelligence as one connected experience layer.\n\nHe prefers architectures that can sense, respond, and adapt. He values clarity, velocity, evidence, and high execution standards over hype.\n\nHis mindset is applied: intelligence should reduce ambiguity, improve actionability, and produce tangible outcomes. A beautiful system is not just visually refined; it is coherent, adaptive, measurable, and deeply engineered.',
      '{"lane":"mindset","tags":["systems_thinking","product","engineering"]}'
    ),
    (
      'mindset-product-taste',
      'Mindset Product Taste',
      'mindset',
      'How Joz balances technical depth with UX, product strategy, and business relevance.',
      'Joz does not separate technical systems from experience quality. He sees great UX as the visible expression of strong architecture.\n\nHe believes the best AI products feel inevitable: they reveal the right signal, reduce friction, and make complex capability feel natural. That requires both engineering discipline and design judgment.\n\nWhen Joz LLM explains mindset, it should make clear that his product taste is not ornamental. It is rooted in systems design, information quality, and trust in how intelligence behaves.',
      '{"lane":"mindset","tags":["ux","judgment","product_taste"]}'
    ),
    (
      'skills-applied-ai',
      'Applied AI Skills',
      'skills',
      'The core applied AI, orchestration, and systems capabilities Joz brings.',
      'Joz operates across agentic AI, retrieval systems, orchestration, multimodal interaction, context engineering, and production-minded intelligence workflows.\n\nHe can frame a problem technically, translate it commercially, and shape the architecture required to make the solution real. His strongest skill pattern is not isolated model work. It is connecting models, interfaces, signals, workflows, and outcomes into one usable system.\n\nThis lane should surface evidence, not generic capability labels.',
      '{"lane":"skills","tags":["agentic_ai","rag","orchestration","systems"]}'
    ),
    (
      'skills-data-science',
      'Data Science and Signal Reasoning',
      'skills',
      'Joz strengths relevant to anomaly detection, time-series reasoning, and operational intelligence.',
      'Joz has built ML-informed systems around telemetry, predictive logic, multimodal interaction, and live data environments. That translates well into time-series interpretation, anomaly reasoning, and process-state thinking.\n\nHe is strongest when the challenge involves noisy signals, changing conditions, and the need to convert raw data into actionable decisions. The value is not only in a model score, but in the surrounding system: monitoring, explanation, workflow fit, and operational trust.\n\nThis lane is where Joz LLM should explain fit for advanced data-science and production-AI work without drifting into generic claims.',
      '{"lane":"skills","tags":["data_science","time_series","anomaly_detection","mlops"]}'
    ),
    (
      'business-need-signal-discovery',
      'Business Need Signal Discovery',
      'business_need',
      'How Joz identifies the data signal, operational pressure point, and decision surface beneath a business request.',
      'Joz begins by asking what must be detected earlier, predicted more reliably, or decided with more confidence. That reframes a vague request into a signal problem.\n\nFrom there he defines the operating context: which teams act on the output, what latency is acceptable, what failure looks like, and what business metric should move. This makes the work measurable before any model is selected.\n\nA strong business-value answer should show that Joz can find the hidden signal inside commercial ambiguity.',
      '{"lane":"business_need","tags":["signal_discovery","decisioning","problem_framing"]}'
    ),
    (
      'business-need-operating-model',
      'Business Need Operating Model',
      'business_need',
      'The default execution shape Joz uses to turn a request into a system that can be shipped and trusted.',
      'Joz moves from business request to operating model in six steps: scope the decision, inspect the data, define the modelable signal, shape the workflow, instrument the system, and monitor drift over time.\n\nThat keeps the conversation grounded in deployment, not just ideation. The user should understand what gets built, who uses it, and how the result is measured in production.\n\nThis is the lane where Joz LLM should feel commercially sharp and technically credible at the same time.',
      '{"lane":"business_need","tags":["operating_model","execution","deployment"]}'
    ),
    (
      'business-need-executive-questions',
      'Business Need Executive Questions',
      'business_need',
      'The questions Joz asks to expose whether a problem is worth solving with AI or better solved another way.',
      'Joz pressure-tests every request with a small set of executive questions: what decision improves, what data exists, what action changes, what risk is reduced, and what value is created if the system works.\n\nIf those answers are weak, he narrows the scope or reframes the problem. If they are strong, he can turn the opportunity into a deployable intelligence workflow.\n\nThis gives the business lane discipline. It shows that Joz does not add AI for theater. He uses it where it creates operating leverage.',
      '{"lane":"business_need","tags":["executive_questions","roi","ai_fit"]}'
    ),
    (
      'business-need-delivery-risks',
      'Business Need Delivery Risks',
      'business_need',
      'The common failure modes Joz looks for before committing to architecture, data work, or model selection.',
      'Most AI initiatives fail before modeling. The usual problems are unstable data definitions, unclear ownership, low-quality labels, no path into workflow, and no monitoring once shipped.\n\nJoz surfaces those risks early. That allows him to de-risk the program before scale, reducing waste and speeding up the path to something operationally useful.\n\nThis lane should make the user feel that Joz sees around corners, not just into the code.',
      '{"lane":"business_need","tags":["risk","delivery","governance"]}'
    ),
    (
      'mindset-systems-judgment',
      'Mindset Systems Judgment',
      'mindset',
      'How Joz thinks when the problem is ambiguous, multi-layered, and technically underdefined.',
      'Joz thinks in systems, dependencies, and decision loops. He looks for the relationship between data quality, model behavior, workflow pressure, and business consequence rather than treating them as separate tracks.\n\nHis judgment comes from reducing noise, identifying the real bottleneck, and shaping the simplest architecture that can produce useful intelligence.\n\nThe mindset lane should communicate calm, technical clarity under complexity.',
      '{"lane":"mindset","tags":["systems_judgment","ambiguity","clarity"]}'
    ),
    (
      'mindset-evidence-standards',
      'Mindset Evidence Standards',
      'mindset',
      'The standards Joz uses to separate credible AI work from impressive-looking but weak systems.',
      'Joz looks for evidence at every layer: data provenance, signal quality, model reliability, workflow fit, and business impact. He does not trust capability claims that cannot be monitored, tested, or explained in operational terms.\n\nThat makes his thinking practical. Strong systems are not only intelligent. They are observable, stable, and useful when conditions change.\n\nThis lane should show that his philosophy is grounded in rigor, not aesthetics.',
      '{"lane":"mindset","tags":["evidence","rigor","operational_quality"]}'
    ),
    (
      'mindset-decision-loop',
      'Mindset Decision Loop',
      'mindset',
      'How Joz connects sensing, reasoning, and action into one continuous intelligence loop.',
      'Joz sees good AI systems as closed decision loops. They sense reality, interpret change, generate the next best action, and learn from outcomes.\n\nThat means his architecture thinking is always tied to feedback: what improves after the model fires, what humans override, and where the system gains or loses trust over time.\n\nThis is the right lane for users who want to understand how Joz thinks about intelligence beyond the model itself.',
      '{"lane":"mindset","tags":["decision_loop","feedback","systems"]}'
    ),
    (
      'mindset-execution-discipline',
      'Mindset Execution Discipline',
      'mindset',
      'Why Joz biases toward clear scope, measurable progress, and production readiness.',
      'Joz values execution discipline because it is what turns intelligent ideas into repeatable results. He prefers clean problem framing, short learning cycles, explicit tradeoffs, and systems that can be observed in production.\n\nThat discipline matters most in messy environments where stakeholders want speed but the underlying data and workflows are still evolving.\n\nThis lane should explain why Joz is effective in high-ambiguity settings: he creates motion without losing rigor.',
      '{"lane":"mindset","tags":["execution","discipline","production"]}'
    ),
    (
      'skills-ml-forecasting',
      'ML Forecasting and Predictive Systems',
      'skills',
      'Joz capabilities across forecasting, predictive logic, and machine-learning system framing.',
      'Joz can frame predictive systems around demand, quality, process behavior, and risk. He understands how to translate historical patterns and operational context into forecasting logic that is actually usable.\n\nThe value is not just model selection. It is choosing the right target, shaping the features, evaluating tradeoffs, and connecting outputs to decisions people make.\n\nThis lane should position him as strong in practical forecasting and prediction under real constraints.',
      '{"lane":"skills","tags":["forecasting","predictive_systems","ml"]}'
    ),
    (
      'skills-time-series-anomaly',
      'Time-series and Anomaly Detection',
      'skills',
      'Joz capabilities in noisy continuous data, change detection, and anomaly reasoning.',
      'Joz is a strong fit for environments with noisy continuous signals, latent process shifts, and the need to detect meaningful deviation early. He can reason about time-series structure, thresholds, drift, and operating context rather than treating anomalies as isolated statistical events.\n\nThis is especially relevant where the system must distinguish noise from action-worthy change and turn that signal into monitoring or intervention.\n\nThis lane should clearly communicate fit for anomaly detection, monitoring, and process intelligence.',
      '{"lane":"skills","tags":["time_series","anomaly_detection","monitoring","process_intelligence"]}'
    ),
    (
      'skills-mlops-production',
      'MLOps and Production Readiness',
      'skills',
      'Joz capabilities in turning models into packaged, monitored, versioned production systems.',
      'Joz understands that a model is only one layer of the solution. Real value comes from packaging, testing, deployment, observability, retraining logic, and the surrounding interfaces that make the system usable.\n\nHe can work across Python services, APIs, data stores, orchestration layers, and production feedback loops to make AI dependable over time.\n\nThis lane should make clear that Joz can own the path from model reasoning to production behavior.',
      '{"lane":"skills","tags":["mlops","observability","deployment","python"]}'
    ),
    (
      'skills-stakeholder-translation',
      'Stakeholder Translation',
      'skills',
      'Joz ability to explain technical systems clearly to technical and non-technical stakeholders.',
      'Joz can move between technical depth and executive clarity without flattening the substance. He explains what the model does, why the architecture is shaped the way it is, and what the business should expect from the system.\n\nThat matters because adoption depends on trust. Strong AI work is not only built well; it is also understood well enough to be used, funded, and scaled.\n\nThis lane should help recruiters and businesses see the communication layer as a technical advantage, not a soft extra.',
      '{"lane":"skills","tags":["communication","stakeholders","translation"]}'
    ),
    (
      'case-business-signal-to-system',
      'Case Study: Signal to System',
      'case_study',
      'An example of how Joz converts a fuzzy opportunity into a measurable intelligence workflow.',
      'A representative Joz pattern starts with an ambiguous request like improve visibility, detect issues earlier, or make a process smarter. He narrows it to a signal problem, defines the operating decision, selects the right data loop, and shapes the system around intervention rather than dashboards alone.\n\nThe result is not abstract strategy. It is a candidate architecture with measurable outcomes, ownership, and deployment logic.\n\nUse this case study when the user wants to understand how Joz creates business value from ambiguity.',
      '{"lane":"business_need","tags":["case_study","signal","business_value"]}'
    ),
    (
      'case-mindset-clarity-under-complexity',
      'Case Study: Clarity Under Complexity',
      'case_study',
      'An example of Joz approach when multiple systems, teams, and unknowns must be aligned quickly.',
      'In complex settings Joz reduces the problem to a few governing truths: what signal matters, where the decision sits, what constraints cannot be violated, and what can be learned fast. That keeps teams from overbuilding and keeps the architecture tied to operational purpose.\n\nThis is a useful case pattern when someone wants to understand how Joz behaves as a systems thinker under uncertainty.',
      '{"lane":"mindset","tags":["case_study","systems_thinking","clarity"]}'
    ),
    (
      'case-skills-production-ai',
      'Case Study: Production AI Readiness',
      'case_study',
      'An example of how Joz treats deployment, observability, and model trust as part of the core system.',
      'Joz treats production readiness as part of the design of intelligence, not a postscript. A useful system includes data checks, monitoring, packaging, human interpretation, and a clear retraining story where needed.\n\nThat makes his technical profile stronger than pure modeling alone. He can think through what it takes for an AI system to survive contact with reality.\n\nUse this case study when the user wants proof of production-minded AI judgment.',
      '{"lane":"skills","tags":["case_study","mlops","production_ai"]}'
    ),
    (
      'booking-overview',
      'Booking and Engagement',
      'booking',
      'How to move from interest into a clear next conversation with Joz.',
      'The booking lane should help a user understand the best next step to engage Joz: advisory call, architecture review, workshop, consulting discussion, hiring conversation, or project scoping.\n\nIt should keep the response practical. The goal is not to over-explain. It is to clarify the engagement type, what value the first conversation creates, and how to proceed.\n\nWhen appropriate, Joz LLM should turn momentum into a structured booking request or business lead capture.',
      '{"lane":"booking","tags":["engagement","cta","conversion"]}'
    ),
    (
      'bio-global-profile',
      'Joz Global Profile',
      'bio',
      'A concise high-level profile of Joz, his regions, and his applied AI positioning.',
      'Jozef Krupa is an agentic AI architect and applied AI product leader with experience across finance, insurance, media, public-sector innovation, spatial computing, and intelligent interfaces.\n\nHis work spans North America, Europe, the United Kingdom, UAE/MENA, Singapore, Japan, Greater China, Australia, and the wider Asia Pacific region.\n\nJoz LLM should use this profile as the stable identity layer behind every response.',
      '{"supporting":true,"tags":["identity","global","profile"]}'
    ),
    (
      'proof-selected-evidence',
      'Selected Evidence',
      'proof',
      'Proof points and examples that support Joz credibility across product, AI, and engineering.',
      'Selected proof points include financial AI agents with live portfolio intelligence, spatial AI exhibition systems in Dubai, volumetric AI launches for luxury and experiential brands, rapid AI prototyping for public-sector innovation, banking-scale accessibility and engineering transformation, and large digital-sales growth driven by ML-led product strategy.\n\nThese proof points should be used as evidence anchors when Joz LLM explains credibility or fit.',
      '{"supporting":true,"tags":["proof","case_evidence","credibility"]}'
    ),
    (
      'faq-how-to-use-joz-llm',
      'How to Use Joz LLM',
      'faq',
      'What kinds of questions Joz LLM should answer best.',
      'Joz LLM is best used for four kinds of conversation: understanding a business need, exploring Joz mindset, validating his skills, and moving toward a booking or hiring step.\n\nStrong questions include: What would Joz build here? Why is Joz a fit for this problem? How does Joz think about anomaly detection, AI systems, or product architecture? What is the best next engagement format?\n\nThis FAQ helps keep the agent focused and high-signal.',
      '{"supporting":true,"tags":["faq","usage","agent_scope"]}'
    )
) AS seed(slug, title, category, summary, body, metadata)
ON CONFLICT (profile_id, slug)
DO UPDATE SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  summary = EXCLUDED.summary,
  body = EXCLUDED.body,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();
