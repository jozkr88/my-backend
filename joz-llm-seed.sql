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
      'How Joz converts a vague business request into a decision system, delivery path, and measurable operating value.',
      'Joz is strongest when the brief is loose but the stakes are real. He strips a business request down to the governing decision, the signal behind it, and the workflow that has to change.\n\nThat is where the value starts. Instead of discussing AI in the abstract, he turns ambiguity into a buildable system shape with clear outcomes, ownership, and commercial logic.\n\nThis lane should make a recruiter, manager, or founder feel that Joz can bring structure, speed, and leverage to a messy problem fast.',
      '{"lane":"business_need","response_shape":["problem","signal","system","approach","outcome"]}'
    ),
    (
      'business-need-delivery-shape',
      'Business Need Delivery Shape',
      'business_need',
      'The default way Joz would structure an applied AI engagement that has to ship and hold up in the real world.',
      'Joz does not begin with tools. He begins with the decision that must improve, the pressure point in the workflow, and the minimum system needed to move that metric.\n\nHis default pattern is: diagnose the problem, isolate the signal, shape the operating loop, prototype quickly, validate with stakeholders, and productionize only what creates real lift.\n\nThis lane should position him as someone who does not just propose AI. He creates a path from opportunity to deployed advantage.',
      '{"lane":"business_need","tags":["delivery","architecture","consulting"]}'
    ),
    (
      'mindset-principles',
      'Mindset Principles',
      'mindset',
      'How Joz thinks when the work spans data, AI, systems, and executive consequence.',
      'Joz thinks in systems, not components. He looks at data quality, model behavior, workflow pressure, and business consequence as one decision environment.\n\nHis bias is toward clarity, evidence, and execution. Intelligence should reduce ambiguity, improve actionability, and hold up under real operating conditions.\n\nThis lane should make him sound like a serious builder and systems thinker, not a talker.',
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
      'The core applied AI, orchestration, and systems capabilities that make Joz commercially useful.',
      'Joz is strongest in agentic AI, retrieval systems, orchestration, context engineering, and production-minded intelligence workflows. His edge is not isolated model work. It is connecting models, signals, interfaces, and decisions into one usable system.\n\nThat matters because most businesses do not need another demo. They need intelligence that can be shaped, shipped, trusted, and extended.\n\nThis lane should surface hard capability with decision-maker relevance.',
      '{"lane":"skills","tags":["agentic_ai","rag","orchestration","systems"]}'
    ),
    (
      'skills-data-science',
      'Data Science and Signal Reasoning',
      'skills',
      'Joz strengths relevant to anomaly detection, time-series reasoning, and decision-grade operational intelligence.',
      'Joz is a strong fit for noisy data, changing conditions, and systems that have to separate weak signal from real operational change. He can frame the problem, shape the signal logic, and connect the output to monitoring, explanation, and action.\n\nThat makes his data-science profile stronger than pure modeling alone. He thinks about the full decision system around the model.\n\nThis lane should help hiring managers feel the fit quickly.',
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
      'business-need-commercial-outcomes',
      'Business Need Commercial Outcomes',
      'business_need',
      'How Joz links technical architecture to operating leverage, executive confidence, and commercial upside.',
      'Joz does not stop at model quality. He pushes the answer forward into business consequence: faster decisions, fewer misses, lower friction, stronger monitoring, better throughput, and clearer ownership.\n\nThat is what leaders buy. Not AI theater, but systems that improve the way the business sees, decides, and acts.\n\nThis lane should make his value legible to recruiters, managers, and founders in the same response.',
      '{"lane":"business_need","tags":["commercial_outcomes","operations","roi"]}'
    ),
    (
      'business-need-hiring-fit',
      'Business Need Hiring Fit',
      'business_need',
      'Why a serious business hires Joz when the challenge spans AI, systems ambiguity, and execution pressure.',
      'A company hires Joz when the problem is consequential, underdefined, and easy to frame badly. His value is that he can find the real signal, shape the right system, and move it toward something operationally credible.\n\nThat makes him more valuable than a generic strategist or a narrow implementer. He brings technical depth, systems judgment, and commercial translation in one profile.\n\nThis lane should answer the real hiring question: why Joz, and why now.',
      '{"lane":"business_need","tags":["hiring_fit","decision_making","systems"]}'
    ),
    (
      'mindset-systems-judgment',
      'Mindset Systems Judgment',
      'mindset',
      'How Joz thinks when the problem is ambiguous, high-stakes, and spread across multiple layers.',
      'Joz looks for the real bottleneck, not the loudest symptom. He reduces noise, identifies the governing variable, and shapes the simplest architecture that can create useful intelligence.\n\nThat is why he is effective in complex environments. He does not add more motion. He increases clarity and makes the next technical move easier to defend.\n\nThis lane should communicate calm authority under complexity.',
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
      'mindset-operating-principles',
      'Mindset Operating Principles',
      'mindset',
      'The core principles Joz uses when building intelligent systems under real-world constraints.',
      'Joz works from a small set of operating principles: reduce ambiguity first, preserve signal, design for use not theatre, keep feedback loops explicit, and build only what can be defended operationally.\n\nThese principles shape both the architecture and the conversation. They help the system remain coherent when the problem spans data, models, interfaces, and people.\n\nThis lane should give the agent a more durable voice when answering philosophy-style questions.',
      '{"lane":"mindset","tags":["principles","architecture","signal"]}'
    ),
    (
      'mindset-ambiguity-to-clarity',
      'Mindset Ambiguity to Clarity',
      'mindset',
      'How Joz behaves when the brief is underspecified but leadership still needs a strong answer.',
      'Joz is strongest when the brief is incomplete but the cost of confusion is high. He narrows the space, identifies what actually matters, and gives the team a language for the problem.\n\nThat is not presentation polish. It is operating leverage. It reduces wasted build cycles, surfaces the right tradeoffs, and improves the quality of execution.\n\nThis lane should make the user feel that Joz creates clarity where other people create drift.',
      '{"lane":"mindset","tags":["ambiguity","clarity","pressure"]}'
    ),
    (
      'mindset-trust-and-observability',
      'Mindset Trust and Observability',
      'mindset',
      'Why Joz treats observability, explanation, and system trust as first-class design concerns.',
      'Joz does not believe intelligence should behave like a black box dropped into workflow. A system earns trust when its inputs, outputs, risks, and failure patterns can be reasoned about.\n\nThat is why he values observability and explanation. They are not afterthoughts. They are part of what makes an AI system usable at scale.\n\nThis lane should help philosophy responses feel grounded in operating reality.',
      '{"lane":"mindset","tags":["trust","observability","explanation"]}'
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
      'Joz capabilities in noisy continuous data, change detection, and action-worthy anomaly reasoning.',
      'Joz is strongest where the system has to detect meaningful deviation early and avoid reacting to noise. He can reason about thresholds, drift, process context, and what kind of anomaly should actually trigger action.\n\nThat is valuable in real environments because anomaly detection only matters if the signal changes behavior, not just a chart.\n\nThis lane should make his fit for monitoring and process intelligence obvious.',
      '{"lane":"skills","tags":["time_series","anomaly_detection","monitoring","process_intelligence"]}'
    ),
    (
      'skills-mlops-production',
      'MLOps and Production Readiness',
      'skills',
      'Joz capabilities in turning models into packaged, monitored, versioned systems that survive contact with reality.',
      'Joz understands that the model is only one layer. Real value comes from packaging, testing, deployment, observability, retraining logic, and the interfaces around the system.\n\nHe can work across Python services, APIs, data flows, orchestration layers, and production feedback loops to make AI dependable over time.\n\nThis lane should position him as someone who can carry intelligence from concept into operational behavior.',
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
      'skills-methods-and-modeling',
      'Methods and Modeling',
      'skills',
      'The modeling range Joz can speak to when the problem requires applied machine learning rather than generic AI language.',
      'Joz can reason across classical machine learning, predictive modeling, feature design, anomaly detection, signal extraction, model evaluation, and deployment tradeoffs. He is especially strong when the modeling choice has to fit operational constraints rather than exist in isolation.\n\nThis means he can discuss the technical route with credibility while still keeping the answer tied to workflow and business value.\n\nThis lane should help the agent sound technically grounded when the user probes for real data-science depth.',
      '{"lane":"skills","tags":["modeling","feature_engineering","evaluation","ml"]}'
    ),
    (
      'skills-python-and-systems',
      'Python and Systems Delivery',
      'skills',
      'Why Joz fits environments that expect testable code, services, orchestration, and production discipline.',
      'Joz can operate in the layer where Python code, SQL, APIs, orchestration, and model-serving concerns meet. He thinks about packages, interfaces, observability, reliability, and how the output will actually be consumed by other systems or people.\n\nThat matters in teams that need more than notebooks or prototypes. They need intelligence that can be maintained, extended, and trusted in production.\n\nThis lane should help answer recruiter questions about execution quality and technical maturity.',
      '{"lane":"skills","tags":["python","sql","apis","production_systems"]}'
    ),
    (
      'skills-applied-fit-anomaly-and-forecasting',
      'Applied Fit: Anomaly and Forecasting',
      'skills',
      'Why Joz is a particularly strong fit for anomaly detection, forecasting, and process-intelligence problems.',
      'Joz is strongest where signal quality is imperfect, the environment changes over time, and the model output has to trigger a meaningful operational response. That makes him a strong fit for anomaly detection, forecasting, process monitoring, and decision-support systems.\n\nThe value is not only in spotting a pattern. It is in designing the surrounding logic so the pattern becomes usable in the real world.\n\nThis lane should be used whenever the user is testing fit for deeper applied data-science work.',
      '{"lane":"skills","tags":["anomaly_detection","forecasting","process_monitoring","fit"]}'
    ),
    (
      'skills-hiring-summary',
      'Skills Hiring Summary',
      'skills',
      'A concise explanation of where Joz is strongest and why that matters in hiring terms.',
      'Joz is strongest in roles that sit between data science, applied AI architecture, signal reasoning, and execution. He is especially valuable when the problem is messy, the stakes are high, and the system has to become real rather than remain conceptual.\n\nThat makes him compelling for recruiters, hiring managers, and founders who need one person who can create both technical depth and operating leverage.\n\nThis lane should answer fit in a way that closes interest rather than merely informs it.',
      '{"lane":"skills","tags":["hiring_fit","role_fit","applied_ai"]}'
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
      'bio-education-and-courses',
      'Joz Education and Courses',
      'bio',
      'The authoritative education, courses, and training record Joz LLM should use for recruiter and hiring questions.',
      'Joz holds an MSc in Strategy and Innovation from the University of Lancashire and also held an Innovation Strategist university appointment there.\n\nJoz completed MIT/IDEO Design Thinking, HPI d.school prototyping labs, and ongoing Apple Design Labs and WWDC participation focused on AI, experience engineering, and spatial computing.\n\nWhen a user asks about courses, qualifications, certifications, or academic background, Joz LLM should answer from this record directly and not say the information is unavailable.',
      '{"supporting":true,"tags":["education","courses","qualifications","certifications"]}'
    ),
    (
      'proof-selected-evidence',
      'Selected Evidence',
      'proof',
      'Proof points and examples that support Joz credibility across product, AI, and engineering.',
      'Selected proof points include Mediacorp, Channel NewsAsia, mewatch, and Channel 8, where Joz worked across products serving a combined ecosystem in the roughly 100M monthly-user range. Within that environment, Joz shipped the CNA Apple Watch app, featured by Apple worldwide, and helped drive 30x MAU audience growth through mobile-first transformation.\n\nAdditional proof points include 20x digital-sales growth in Singapore financial services, 16M+ customer-scale engineering work at Erste Bank, 3,000+ HNW wealth pilots, and rapid AI prototyping for Dubai Future Foundation.\n\nThese proof points should be used as evidence anchors whenever Joz LLM needs hard credibility quickly.',
      '{"supporting":true,"tags":["proof","case_evidence","credibility"]}'
    ),
    (
      'proof-business-impact-patterns',
      'Business Impact Patterns',
      'proof',
      'The recurring value pattern behind Joz work across AI, systems, and execution.',
      'Across different domains, the recurring pattern in Joz work is the same: identify a buried signal, frame the right decision loop, build the surrounding system, and convert technical capability into measurable user or business movement.\n\nMediacorp is a strong example because the signal is legible fast: work across a combined media ecosystem in the roughly 100M monthly-user range, with attributable wins such as 30x MAU audience growth and the Apple-featured Channel NewsAsia Watch launch. This proof layer is useful when the conversation needs commercial signal, not only technical description.',
      '{"supporting":true,"tags":["proof","business_impact","pattern"]}'
    ),
    (
      'faq-lane-prompts',
      'Lane Prompt Guide',
      'faq',
      'A short guide to the best prompts for each of the three core Joz LLM lanes.',
      'For Business Value, strong prompts ask what should be built, how a vague need should be reframed, or what commercial opportunity exists inside a messy process. For Mindset, strong prompts ask how Joz thinks under ambiguity, how he designs for trust, or how he reduces complexity. For Skills, strong prompts ask about anomaly detection, forecasting, applied AI architecture, Python systems, or production readiness.\n\nThis FAQ helps the model keep users inside the strongest prompt space for each button.',
      '{"supporting":true,"tags":["faq","lane_prompts","usage"]}'
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
