## Neo Maxx Portal

This file records the currently authored understanding of the `neo/maxx` portal based on code inspection and frame extraction from the recording.

### Confirmed Portal Structure

- `root -> /neo/maxx`
- `neurotransmitters`
  - primary neuron explainer state
  - visible semantics include:
    - `Voice AI Agent MAXX`
    - `Human Neuron`
    - `AI Neuron`
    - `Neurotransmitters`
    - `Spatial Capability`
- `inside_the_brain`
  - revealed abstract inside-the-brain layer after pausing the explainer
  - visible semantics include:
    - `The Elite Beauty`
    - `Ascension`
    - `10/10 Frame Mogg`

### Confirmed Voice / Action Model

- `n2x_pause`
  - transitions `neurotransmitters -> inside_the_brain`
- `n2x_resume`
  - transitions `inside_the_brain -> neurotransmitters`
- `launch_in_space_n2x`
  - opens AR / space mode
- `back`
  - exits to `/`

### Confirmed N2X Sequence Cues

From extracted frames, the portal clearly presents:

- a neuron explainer phase
- text about neurotransmitters sending signals between neurons
- a later phase about experiences stabilizing new pathways
- a deeper inside-the-brain reveal phase
- a return to the neuron explainer

### Current Limit

The backend now knows these semantics, but the frontend currently only publishes the live `maxx` substate at the coarse level:

- `neurotransmitters`
- `inside_the_brain`

It does not yet publish fine-grained timeline phases like:

- `n2x_signal_flow`
- `n2x_new_pathways`
- `neurodesign_focus_elite_beauty`

If those are needed, the next step is to wire explicit phase tracking from the active animation timeline in the frontend.
