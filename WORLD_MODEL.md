## Structured World Model

The backend now supports a relational world graph for deterministic awareness.

### What it stores

- `world_portals`: top-level worlds such as `root`, `meet-joz`, `the-vibe-energy`
- `world_states`: legal states inside each portal
- `world_actions`: canonical actions the app understands
- `world_objects`: interactive objects and their mesh-level identity
- `world_object_aliases`: spoken synonyms for those objects
- `world_state_actions`: legal actions for each state
- `world_state_transitions`: deterministic next-step routes for a state/action pair
- `world_transition_phrases`: utterances that map to each state transition

### How it is used

`/api/think`:
- infers the current structured state from `currentPortal` and `currentMesh`
- loads that state from Postgres when a database is configured
- injects `structuredState` and `structuredAvailableActions` into the agent context
- resolves deterministic actions from state transition phrases before heuristic fallbacks

`/api/agentic`:
- builds the same structured snapshot for the full-agent layer
- lets the model plan against the live state graph
- still passes every proposal through deterministic approval

### Current seed coverage

- `root`
  - `brain -> /neo/maxx`
  - `ball -> /neo/meet-joz`
- `meet-joz`
  - `vibe`, `discover`, `skills`
  - semantic objects:
    - `worldx_desktop`
    - `golden_environment_mobile`
    - `capsule`
    - `heart`
    - `clout_maxx`
    - `scale_maxx`
    - `alpha_psl`
    - `world_class`
    - `atmos_maxx`
    - `cross_sensory_aura_engineering`
    - `maximize_beauty_change_reality`
    - `ai_synthesis`
    - `ai_analysis`
    - `signature`
  - back/pause/resume/launch transitions
- `the-vibe-energy`
  - `neurotransmitters`
  - `inside_the_brain`
  - `n2x_pause`
  - `n2x_resume`
  - `back`
  - `launch_in_space_n2x`

### Important constraint

This gives the agent a canonical world model, but full awareness still depends on authoring complete seed data for every state and object that exists in the app. Videos help discover that data, but the SQL graph is the source of truth.
