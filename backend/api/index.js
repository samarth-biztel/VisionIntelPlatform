import { createApp } from "../src/app.js";

const { app } = await createApp({ checkOnly: true });

export default app;
