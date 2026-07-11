## Joz LLM Architecture

This is the first production-oriented architecture for `Joz LLM` using:

- `Render` for the app and orchestration layer
- `Supabase` for Postgres, storage, and retrieval-backed knowledge
- optional `Redis` later for hot session memory, caching, and queues

### System shape

1. `UI layer`
   - React voice/chat interface
   - quick actions like `Business Need`, `Mindset`, `Skills`, `Book Joz`

2. `Orchestration layer`
   - Express backend on Render
   - intent detection
   - persona control
   - retrieval composition
   - lead capture and booking actions

3. `Knowledge layer`
   - `joz_profiles`
   - `joz_documents`
   - `joz_document_chunks`
   - optional embeddings in `joz_document_chunks.embedding`

4. `Conversation layer`
   - `joz_conversations`
   - `joz_messages`

5. `Business action layer`
   - `joz_business_leads`
   - `joz_booking_requests`

### Request flow

1. The user sends a message from the popup.
2. The Render backend classifies the user intent:
   - `business_need`
   - `recruiter_fit`
   - `mindset`
   - `skills`
   - `booking`
3. The backend loads the primary profile from `joz_profiles`.
4. Relevant knowledge is retrieved from `joz_documents` and `joz_document_chunks`.
5. A Joz-specific system prompt is composed with:
   - persona rules
   - current user intent
   - retrieved evidence
   - conversation history
6. The model response is generated.
7. The user and assistant messages are persisted.
8. If the message expresses hiring or business intent, a structured record is written to:
   - `joz_business_leads`, or
   - `joz_booking_requests`

### Recommended document categories

- `bio`
- `skills`
- `case_study`
- `mindset`
- `service`
- `proof`
- `faq`

### What to build next

1. Replace the current role-specific Joz LLM prompt with a generic Joz agent prompt.
2. Add an ingestion script that converts source content into `joz_documents`.
3. Add chunking + embedding generation for `joz_document_chunks`.
4. Update `/api/joz-llm` to retrieve Joz documents from Supabase instead of relying only on static in-code profile data.
5. Persist conversations and leads in the new tables.

### Redis later, not now

Add Redis only when one of these becomes real:

- low-latency session memory
- cached retrieval/model outputs
- rate limiting
- background task queues
- multi-step async agent workflows
