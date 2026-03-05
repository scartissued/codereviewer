import { createNodeMiddleware } from '@octokit/app';
import { app } from './app.js';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { createGitHubApp } from './services/github.service.js';

const PORT = env.port;

async function start() {
  if (env.githubEnabled) {
    try {
      const githubApp = await createGitHubApp();
      app.use(
        createNodeMiddleware(githubApp, { pathPrefix: '/api/v1/github' }),
      );
    } catch (err) {
      console.error('Error intializing Github: ', err);
    }
  } else {
    console.warn(
      'GitHub integration disabled. Please review Github credentials',
    );
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  app.listen(PORT, () => {
    console.log(`codereviewer API is running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
