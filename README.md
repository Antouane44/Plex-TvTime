# Présentation

Ce script permets de récupérer les films et séries vu sur Plex afin de les marquer comme vue sur TvTime. Ce script est en version Beta, certaines erreurs peuvent survenir.

# Fonctionnement

1. Les informations de connexion à Plex et TvTime sont demandés si celles-ci ne sont pas déjà présentes dans le fichier ```config.json```.

2. La récupération des ID TVDB est effectué pour les films(```movies.db```) et épisodes(```shows.db```) si les IDs ne sont pas déjà présent dans ```movies.db.old``` et ```shows.db.old```.

3. Ces IDs sont utilisés afin de les marquer en vues sur TvTime et sont stockés dans ```shows.db.old``` et ```movies.db.old```.

4. Un récapiulatif des erreurs est fait en se basant sur les fichiers ```errShows.txt```, ```failedRatingKeys.txt``` et ```movies.db```.

# Lancement 

La première fois le traitement seras plus long.
Il est possible de modifier la configuration dans le fichier conf.json

Pour lancer le script, il faut se rendre dans le dossier ```main``` et exécuter la commande :

```node Main.js```

Il est possible d'éviter le message de dépréciation avec la commande :

```node --no-deprecation Main.js```

ou :

```NODE_NO_WARNINGS=1 node Main.js```

La première fois, il faudra saisir les informations du serveur Plex et ses informations d'authentification.

## Récupération du token Plex

Pour récupérer le token Plex, il est possible de suivre la procédure [suivante](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/).

## Dissocier son compte TvTime

Si votre compte TvTime utilise la connexion Facebook, X, Google. Il ne seras pas possible d'utiliser le script.

Il est toutefois possible de dissocier son compte TvTime de Facebook, X, Google... Via la procédure [suivante](https://tvtime.zendesk.com/hc/en-us/articles/360014600033-I-don-t-have-Facebook-Twitter-anymore-how-can-I-log-in#:~:text=No%20worries%2C%20we've%20got,of%20your%20social%20media%20account).


# Fichiers de sorties

Cette partie est dédié à l'explication des fichiers : 
* ```config.json``` : Fichier contenant les informations du serveur Plex ainsi que les informations d'authentification.
* ```movies.db``` : Contient les ID TVDB des films a marquer comme vu sur TvTime. S'il reste des ID dans ce fichier a la fin du traitement c'est que l'ID n'as pas été trouvé sur TvTime.
* ```movies.db.old``` : Contient les ID TVDB des films marqués comme vu sur TvTime. Est également utilisé afin de ne pas traiter plusieurs fois les mêmes IDs.
* ```shows.db``` : Contient les ID TVDB des séries a marquer comme vu sur TvTime.
* ```shows.db.old``` : Contient les ID TVDB des épisodes marqués comme vu sur TvTime. Est également utilisé afin de ne pas traiter plusieurs fois les mêmes IDs.
* ```errShows.txt``` : Contient les IDs des épisodes qui n'ont pas été trouvé sur TvTime.
* ```failedRatingKeys.txt``` : Contient les valeurs RatingKey pour les épisodes ou films pour lequelle un ID TVDB n'as pas été trouvé.

# Correction des erreurs

Il est possible de corriger les erreurs de ces fichiers, pour les erreurs ```movies.db``` et ```errShows.txt```, il est possible de les marquer en vu manuellement en regardant la correspondance en recherchant l'ID sur [thetvdb](https://thetvdb.com/).

Pour les erreurs dans le fichiers ```failedRatingKeys.txt```, il est possible de trouver la correspondance de l'épisode en le cherchant avec l'URL Plex :
```
http://PLEXIP:PLEXPORT/library/metadata/PLEXRATINGKEY?checkFiles=1&includeAllConcerts=1&includeBandwidths=1&includeChapters=1&includeChildren=1&includeConcerts=1&includeExtras=1&includeFields=1&includeGeolocation=1&includeLoudnessRamps=1&includeMarkers=1&includeOnDeck=1&includePopularLeaves=1&includePreferences=1&includeRelated=1&includeRelatedCount=1&includeReviews=1&includeStations=1&X-Plex-Token=PLEXTOKEN
```
Il est nécessaire de remplacer les valeurs suivantes :
* PLEXIP : Par l'IP du serveur Plex
* PLEXPORT : Par le port du serveur Plex
* PLEXTOKEN : Par le token du serveur Plex
* PLEXRATINGKEY : Par la valeur présente dans le fichier ```failedRatingKeys.txt```

# Docker
## Conteneur

Il est également possible de lancer le script via un conteneur. Il faut dans un premier temps créer un fichier ```config.json``` que l'on déposeras dans le répertoire ```/path/to/folder/config``` du conteneur. C'est le premier prérequis.
Il faut remplacer les champs par vos informations :
```
{
  "token": "YourPlexToken",
  "ip": "YourPlexIP",
  "port": "YourPlexPort",
  "username": "YourTvTimeEmail",
  "password": "YourTvTimePassword"
}
```

Il est ensuite possible de lancer le conteneur :

```
docker run -d \
	--name plextvtime \
	-v /path/to/folder/config:/PlexTvTime/config \
	-v /path/to/folder/data:/PlexTvTime/data \
	-e crontab="0 5 * * *" \
	antouane44/plextvtime:latest
```

Le champ crontab défini le lancement du script. C'est le deuxième prérequis.

> **_NOTE:_** Le cron est en UTC.

## Dockerfile

Il est possible de build sa propre image docker en modifiant le fichier Dockerfile et en lançant la commande suivante :

```docker build -t plextvtime .```
