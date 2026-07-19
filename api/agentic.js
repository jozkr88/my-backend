import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { agentState } = req.body || {};
    if (!agentState) return res.status(400).json({ error: "Missing agentState" });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a reasoning agent for a 3D React Three Fiber scene." },
        { role: "user", content: `Current state: ${JSON.stringify(agentState)}` },
      ],
    });

    const reply = completion.choices[0].message.content;
    res.status(200).json({ reply });
  } catch (e) {
    console.error("❌ agentic.js error:", e);
    res.status(500).json({ error: "Reasoning failed" });
  }
}
