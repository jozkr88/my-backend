The current Joz data architecture is a governed knowledge pipeline rather than a full enterprise operational data platform.

It has five clear layers:

1. Source layer
Raw source material lives in inbox files with sidecar metadata.

2. Normalization layer
Each source is converted into a structured JSON record with fields such as title, summary, lane, verification status, claims, proof points, capabilities, outcomes, governance, and proof links.

3. Ontology layer
Shared taxonomy connects records through problems, principles, capabilities, outcomes, governance, industries, and proofs.

4. Publish layer
The builder produces aggregate runtime artifacts, including the full corpus and a runtime-safe model-ready subset.

5. Retrieval and routing layer
The backend ranks records by lane, relevance, credibility, verification, proof depth, enterprise scale, and measurable outcomes, then routes answers through the appropriate lane.

The important distinction is that this is not yet an ERP, CRM, or analytics warehouse. It is a curated knowledge architecture for proof-backed retrieval, positioning, reasoning, and answer quality.
