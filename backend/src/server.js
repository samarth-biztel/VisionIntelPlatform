import { createApp } from "./app.js";

const shouldCheckOnly = process.argv.includes("--check");
const port = Number(process.env.PORT ?? 7080);

const { app } = await createApp({ checkOnly: shouldCheckOnly });

if (shouldCheckOnly) {
  console.log("api: ok");
} else {
  app.listen(port, () => {
    console.log(`Vision Intel Platform core API listening on http://localhost:${port}`);
  });
}
