FROM node

# Copie de tous les fichiers dans le répertoire PlexTvTime
COPY ./ /PlexTvTime/

# Définition du répertoire de travail
WORKDIR /PlexTvTime/main

# Installation des dépendances nécessaires pour Puppeteer
RUN apt-get update && \
    apt-get install -yq gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libnss3 lsb-release xdg-utils wget && \
    rm -rf /var/lib/apt/lists/*

# Modification des fichiers JS pour utiliser Puppeteer avec les arguments spécifiés
RUN sed -i "s/puppeteer.launch()/puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })/g" /PlexTvTime/main/*.js

# Modification des droits
RUN chmod 700 /PlexTvTime/main/node_modules_local/puppeteer/.cache/chrome/linux-122.0.6261.57/chrome-linux64/chrome

# Nettoyage des fichiers inutiles de Puppeteer
RUN rm -rf /PlexTvTime/main/node_modules_local/puppeteer/.cache/chrome/win64-122.0.6261.57 \
    && rm -rf /PlexTvTime/main/node_modules_local/puppeteer/.cache/chrome-headless-shell

# Installation de Cron
RUN apt-get update && \
    apt-get install -yq cron && \
    rm -rf /var/lib/apt/lists/*

# Création du fichier de log
RUN touch /plextvtime.log

CMD ["sh", "-c", "echo \"$crontab cd /PlexTvTime/main && /usr/local/bin/node --no-deprecation Main.js >> /plextvtime.log 2>&1\n0 4 * * * tail -n 10000 /plextvtime.log > /plextvtime.log.tmp && mv /plextvtime.log.tmp /plextvtime.log\n\" > /var/spool/cron/crontabs/root && crontab /var/spool/cron/crontabs/root && service cron start && tail -F /plextvtime.log"]
