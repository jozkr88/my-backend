// src/utils/tools.js
import { fetchJson, getThinkUrl } from "./api";

export const llmClient = {
  chat: async (prompt) => {
    const data = await fetchJson(getThinkUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    return data.reply;
  },
};

export const tools = {};
