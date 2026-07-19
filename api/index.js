// api/index.js — Vercel entrypoint for your Express backend
import app from "../server/index.js";
import serverlessExpress from "@codegenie/serverless-express";

// This tells Vercel how to run your Express app as a Serverless Function
const handler = serverlessExpress({ app });

export default handler;
export { handler };
