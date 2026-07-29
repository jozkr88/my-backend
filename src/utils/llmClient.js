// utils/llmClient.js
export const llmClient = {
  async respond(prompt) {
    console.log("LLM called with:", prompt);
    return "This is a simulated AI response.";
  },
};

// utils/tools.js
export const tools = {};
