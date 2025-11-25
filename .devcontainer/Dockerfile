FROM mcr.microsoft.com/devcontainers/javascript-node
USER node

RUN npm install -g vercel typescript tsx \
  && vercel -v \
  && tsc -v \
  && tsx -v

RUN curl -fsSL https://deno.land/install.sh | bash -s -- -y \
  && sudo ln -sf $HOME/.deno/bin/deno /usr/local/bin/deno \
  && deno -v
