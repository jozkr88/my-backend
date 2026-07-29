import { useEffect } from "react";

export function useBackendWorldSync({ apiFetch, apiUrl, fetchJson, worldMap }) {
  useEffect(() => {
    fetchJson(apiUrl("/api/world-memory"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mesh: "neurotransmitters",
        action: "toggleNeurotransmitters",
        context: { target: null },
        commands: [
          "pause neurons",
          "pause animation",
          "stop animation",
          "stop neurons",
          "pause",
          "resume neurons",
          "resume animation",
          "continue animation",
          "toggle neurons",
          "play",
          "play neurons",
          "start neurons",
          "start animation",
        ],
      }),
    })
      .then((data) => console.log("🧠 Learned neuron control:", data))
      .catch((error) =>
        console.error("❌ world-memory error for neurotransmitters", error)
      );
  }, [apiUrl, fetchJson]);

  useEffect(() => {
    apiFetch(apiUrl("/api/world-map"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worldMap }),
    })
      .then(() => console.log("🌍 3D World map sent to backend"))
      .catch((error) =>
        console.error("⚠️ Failed to send 3D world map:", error)
      );
  }, [apiFetch, apiUrl, worldMap]);

  useEffect(() => {
    const objects = [
      {
        mesh: "brain",
        action: "portal",
        context: { position: [0, 1, 2], type: "entry", target: "/neo/maxx" },
        commands: [
          "enter",
          "explore",
          "go inside",
          "open portal",
          "open the flex",
          "open maxx",
        ],
      },
      {
        mesh: "ball",
        action: "portal",
        context: { target: "/neo/meet-joz" },
        commands: [
          "meet joz",
          "neo meet joz",
          "talk to joz",
          "joz",
          "open ball",
          "go to ball",
          "meet",
          "meet jaws",
          "meet jos",
        ],
      },
    ];

    objects.forEach((obj) => {
      fetchJson(apiUrl("/api/world-memory"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(obj),
      })
        .then((data) => console.log("🧠 Synced:", obj.mesh, data))
        .catch((error) =>
          console.error("❌ world-memory error for", obj.mesh, error)
        );
    });
  }, [apiUrl, fetchJson]);
}
