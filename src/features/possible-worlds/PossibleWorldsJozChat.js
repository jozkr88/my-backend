import { useEffect, useRef } from "react";
import { useJozLlm } from "../voice/useJozLlm";
import { getPossibleWorldsApiBase } from "../../utils/api";
import { interpretDemoCommand } from "./commandInterpreter";
import { usePossibleWorldsStore } from "./store";

const QUICK_ACTIONS = [
  { label: "Observe", prompt: "The customer added 20% more scope.", intentMode: "business_need" },
  { label: "Simulate", prompt: "What if we add two contractors?", intentMode: "skills" },
  { label: "Compare", prompt: "Compare the safest interventions.", intentMode: "mindset" },
];

function ChatCopy({ content }) {
  return <div className="pwj-chat__copy">{String(content || "").split(/\n+/).map((line, index) => <p key={`${line}-${index}`}>{line || " "}</p>)}</div>;
}

export function PossibleWorldsJozChat() {
  const bridgeRef = useRef(new Set());
  const prepareCommand = usePossibleWorldsStore((state) => state.prepareCommand);
  const joz = useJozLlm({
    currentPortal: "possible-worlds",
    currentMesh: "project-atlas",
    currentMeshStage: "operational-state",
    executeCommand: () => {},
    isMobile: false,
    arSupported: false,
    startOpen: true,
    endpoint: "/api/possible-worlds/joz",
    endpointBase: getPossibleWorldsApiBase(),
  });

  useEffect(() => {
    joz.messages.forEach((message) => {
      if (message.role !== "user" || bridgeRef.current.has(message.id)) return;
      bridgeRef.current.add(message.id);
      prepareCommand(interpretDemoCommand(message.content), message.id, message.content);
    });
  }, [joz.messages, prepareCommand]);

  const submitQuickAction = (action) => {
    joz.selectIntentMode(action.intentMode);
    joz.sendMessage(action.prompt, { intentMode: action.intentMode, starter: false });
  };

  if (!joz.isOpen) {
    return <button type="button" className="pwj-chat__reopen" onClick={joz.toggle}>Open Joz MAXX</button>;
  }

  return <aside className="pwj-chat" aria-label="Joz MAXX for Possible Worlds">
    <div className="pwj-chat__header">
      <div><span className="pwj-chat__eyebrow">World Model Interface</span><h2>Joz MAXX</h2><p>Talk to the Project Atlas model.</p></div>
      <div className="pwj-chat__controls"><span>Alpha</span><button type="button" onClick={joz.close}>Close</button></div>
    </div>
    <div className="pwj-chat__actions" role="toolbar" aria-label="World model actions">
      {QUICK_ACTIONS.map((action) => <button key={action.label} type="button" className={joz.activeIntentMode === action.intentMode ? "is-active" : ""} onClick={() => submitQuickAction(action)} disabled={joz.isLoading}>{action.label}</button>)}
    </div>
    <div className="pwj-chat__messages" aria-live="polite">
      {joz.messages.map((message) => <article key={message.id} className={`pwj-chat__message pwj-chat__message--${message.role}`}>
        <span className="pwj-chat__role">{message.role === "assistant" ? "Joz MAXX" : "You"}</span>
        <ChatCopy content={message.content} />
      </article>)}
    </div>
    <div className="pwj-chat__suggestions"><span>Try asking</span><div>{joz.suggestions.slice(0, 3).map((suggestion) => <button key={suggestion} type="button" onClick={() => joz.sendMessage(suggestion, { starter: false })}>{suggestion}</button>)}</div></div>
    <form className="pwj-chat__composer" onSubmit={joz.handleSubmit}>
      <textarea value={joz.input} onChange={(event) => joz.setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); joz.handleSubmit(event); } }} placeholder="Ask about the current state or a possible future…" rows={2} disabled={joz.isLoading} />
      <button type={joz.isLoading ? "button" : "submit"} aria-label={joz.isLoading ? "Stop generating response" : "Send message"} disabled={!joz.isLoading && (!joz.input.trim() || joz.isCoolingDown)} onClick={joz.isLoading ? joz.stopGeneration : undefined}>{joz.isLoading ? "■" : "↗"}</button>
    </form>
    {joz.isCoolingDown && <div className="pwj-chat__status">Wait {joz.cooldownSeconds}s before the next question.</div>}
    {joz.error && !joz.isCoolingDown && <div className="pwj-chat__error">{joz.error}</div>}
  </aside>;
}
