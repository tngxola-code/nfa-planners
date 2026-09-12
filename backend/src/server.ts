import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 4000);

createApp().then((app) => {
  app.listen(PORT, () => {
    console.log(`NFA Console backend listening on http://localhost:${PORT}`);
  });
});
