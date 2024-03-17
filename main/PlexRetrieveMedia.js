const {
    fs,
    fetch,
    parseString,
    CONFIG_FILE_PATH,
    MOVIES_DB_FILE_PATH,
    MOVIES_DB_OLD_FILE_PATH,
    SHOWS_DB_FILE_PATH,
    SHOWS_DB_OLD_FILE_PATH,
    FAILED_RATINGKEY_FILE_PATH
} = require('./Variables.js');


// Fonction pour lire la configuration depuis le fichier CONFIG_FILE_PATH
function readConfig() {
    try {
        const configFile = fs.readFileSync(CONFIG_FILE_PATH);
        return JSON.parse(configFile);
    } catch (error) {
        return {}; // Si le fichier n'existe pas ou s'il y a une erreur de lecture, retourner un objet vide
    }
}

// Fonction pour récupérer les titres des films à partir de l'URL Plex et du token
async function getMoviesTitles(url, token, plexConfig) {
    try {
        const response = await fetch(`${url}&X-Plex-Token=${token}`);
        // console.log(response)
        if (!response.ok) {
            throw new Error('Erreur de connexion, vérifiez votre token.');
        }
        const xml = await response.text();
        
        // Parsing XML to JSON
        let jsonData;
        parseString(xml, (err, result) => {
            if (err) throw err;
            jsonData = result;
        });

        // Extracting movie titles
        const movieTitles = jsonData?.MediaContainer?.Video?.map(video => {
            return video.$.title;
        });

        // Extracting episode GUIDs
        const moviesGUIDs = [];
        jsonData?.MediaContainer?.Video?.forEach(video => {
            // Extracting ratingKey
            const ratingKey = video?.$.ratingKey;
            console.log(`${ratingKey}`)
            // Calling the new function with ratingKey
            moviesGUIDs.push(extractAndStoreMoviesTVDBID(token, ratingKey, plexConfig));
        });

        return movieTitles;
    } catch (error) {
        throw new Error('Erreur de connexion, vérifiez votre token.');
    }
}

// Fonction pour récupérer les épisodes de séries à partir de l'URL Plex et du token
async function getShowsEpisodes(url, token, plexConfig) {
    return new Promise(async (resolve, reject) => {
        try {
            const response = await fetch(`${url}&X-Plex-Token=${token}`);
            if (!response.ok) {
                throw new Error('Erreur de connexion, vérifiez votre token.');
            }
            const xml = await response.text();
            
            // Parsing XML to JSON
            let jsonData;
            parseString(xml, (err, result) => {
                if (err) throw err;
                jsonData = result;
            });

            // Extracting episode GUIDs
            const episodeGUIDs = [];
            for (const video of jsonData?.MediaContainer?.Video || []) {
                // Extracting ratingKey
                const ratingKey = video?.$.ratingKey;
                console.log(`${ratingKey}`);
                // Calling the new function with ratingKey
                try {
                    const guid = await extractAndStoreTVDBID(token, ratingKey, plexConfig);
                    episodeGUIDs.push(guid);
                } catch (error) {
                    console.error('Erreur lors de l\'extraction et du stockage du GUID TVDB pour la clé de notation', ratingKey, ':', error.message);
                }
            }
            resolve(episodeGUIDs);
        } catch (error) {
            reject(new Error('Erreur lors de la récupération des GUIDs des épisodes de séries : ' + error.message));
        }
    });
}

// Function to extract TVDB ID from episode metadata and store it

async function extractAndStoreTVDBID(token, ratingKey, plexConfig) {
    try {
        console.log('Extraction et stockage du GUID TVDB pour chaque clé de notation...');

        if (!fs.existsSync(SHOWS_DB_FILE_PATH)) {
            fs.writeFileSync(SHOWS_DB_FILE_PATH, '');
        }

        const ratingKeys = ratingKey.split('\n');
        const extractedGUIDs = []; // Tableau pour stocker les GUIDs extraits
        const failedRatingKeys = []; // Tableau pour stocker les ratingKeys en échec

        for (const ratingKeyValue of ratingKeys) {
            let xml = null;
            const apiUrl = `http://${plexConfig.ip}:${plexConfig.port}/library/metadata/${ratingKeyValue}?checkFiles=1&includeAllConcerts=1&includeBandwidths=1&includeChapters=1&includeChildren=1&includeConcerts=1&includeExtras=1&includeFields=1&includeGeolocation=1&includeLoudnessRamps=1&includeMarkers=1&includeOnDeck=1&includePopularLeaves=1&includePreferences=1&includeRelated=1&includeRelatedCount=1&includeReviews=1&includeStations=1&X-Plex-Token=${token}`;
            
            let retryCount = 0;
            const maxRetries = 100;
            while (retryCount < maxRetries) {
                try {
                    const response = await fetch(apiUrl, { timeout: 60000 });
                    if (!response.ok) {
                        throw new Error(`Erreur lors de la récupération des données pour la clé de notation ${ratingKeyValue}.`);
                    }
                    xml = await response.text();
                    break; // Sortir de la boucle si la requête réussit
                } catch (error) {
                    console.error(`Erreur lors de la récupération des données pour la clé de notation ${ratingKeyValue}:`, error.message);
                    retryCount++;
                    console.log(`Tentative ${retryCount} de récupération des données pour la clé de notation ${ratingKeyValue} dans 60 secondes...`);
                    await new Promise(resolve => setTimeout(resolve, 60000)); // Attendre 60 secondes avant de réessayer
                }
            }

            if (xml === null) {
                console.error(`Échec de la récupération des données pour la clé de notation ${ratingKeyValue} après ${maxRetries} tentatives.`);
                failedRatingKeys.push(ratingKeyValue); // Ajouter la ratingKey en échec au tableau
                continue; // Passer à la prochaine itération
            }

            // Parsing XML to JSON
            let jsonData;
            parseString(xml, (err, result) => {
                if (err) {
                    console.error('Erreur de parsing XML :', err);
                    return; // Sortir de la fonction en cas d'erreur de parsing
                }
                jsonData = result;
            });

            // Vérification des données JSON avant d'y accéder
            if (!jsonData || !jsonData.MediaContainer || !jsonData.MediaContainer.Video) {
                console.error('Données JSON non conformes ou manquantes.');
                continue; // Passer à la prochaine itération
            }

            // Extraction du GUID TVDB
            const tvdbGUID = jsonData.MediaContainer.Video[0]?.Guid?.find(guid => guid.$.id.startsWith('tvdb://'))?.$?.id;
            if (!tvdbGUID) {
                console.error('Impossible de trouver le GUID TVDB pour cet épisode.');
                failedRatingKeys.push(ratingKeyValue); // Ajouter la ratingKey en échec au tableau
                continue; // Passer à la prochaine itération
            }
            const tvdbID = tvdbGUID.split('tvdb://')[1];

            // Vérification des IDs existants
            if (fs.existsSync(SHOWS_DB_OLD_FILE_PATH)) {
                const existingIDsOld = fs.readFileSync(SHOWS_DB_OLD_FILE_PATH, 'utf8').split('\n');
                if (existingIDsOld.includes(tvdbID)) {
                    console.log(`ID ${tvdbID} déjà présent dans ${SHOWS_DB_OLD_FILE_PATH}. Ignoré.`);
                    continue; // Passer à la prochaine itération
                }
            }

            const existingIDs = fs.readFileSync(SHOWS_DB_FILE_PATH, 'utf8').split('\n');
            if (existingIDs.includes(tvdbID)) {
                console.log(`ID ${tvdbID} déjà présent dans ${SHOWS_DB_FILE_PATH}. Ignoré.`);
                continue; // Passer à la prochaine itération
            }

            // Stockage du TVDB ID dans SHOWS_DB_FILE_PATH
            fs.appendFileSync(SHOWS_DB_FILE_PATH, tvdbID + '\n');
            console.log(`ID ${tvdbID} ajouté à ${SHOWS_DB_FILE_PATH}.`);

            // Ajouter le GUID extrait au tableau
            extractedGUIDs.push(tvdbID);
        }

            // Stocker les ratingKeys en échec dans un fichier temporaire
            if (failedRatingKeys.length > 0) {
                if (!fs.existsSync(FAILED_RATINGKEY_FILE_PATH)) {
                    fs.writeFileSync(FAILED_RATINGKEY_FILE_PATH, '');
                }
                const existingFailedKeys = fs.readFileSync(FAILED_RATINGKEY_FILE_PATH, 'utf8').split('\n');
                const keysToAdd = failedRatingKeys.filter(key => !existingFailedKeys.includes(key));
                if (keysToAdd.length > 0) {
                    fs.appendFileSync(FAILED_RATINGKEY_FILE_PATH, keysToAdd.join('\n') + '\n');
                }
            }

        // Retourner les GUIDs extraits
        return extractedGUIDs;
    } catch (error) {
        console.error('Erreur lors de l\'extraction et du stockage du GUID TVDB :', error.message);
        // En cas d'erreur, retourner une tableau vide
        return [];
    }
}

async function extractAndStoreMoviesTVDBID(token, ratingKey, plexConfig) {
    try {
        console.log('Extraction et stockage du GUID TVDB pour chaque clé de notation...');

        if (!fs.existsSync(MOVIES_DB_FILE_PATH)) {
            fs.writeFileSync(MOVIES_DB_FILE_PATH, '');
        }

        const ratingKeys = ratingKey.split('\n');
        const extractedGUIDs = []; // Tableau pour stocker les GUIDs extraits
        const failedRatingKeys = []; // Tableau pour stocker les ratingKeys en échec

        for (const ratingKeyValue of ratingKeys) {
            let xml = null;
            const apiUrl = `http://${plexConfig.ip}:${plexConfig.port}/library/metadata/${ratingKeyValue}?checkFiles=1&includeAllConcerts=1&includeBandwidths=1&includeChapters=1&includeChildren=1&includeConcerts=1&includeExtras=1&includeFields=1&includeGeolocation=1&includeLoudnessRamps=1&includeMarkers=1&includeOnDeck=1&includePopularLeaves=1&includePreferences=1&includeRelated=1&includeRelatedCount=1&includeReviews=1&includeStations=1&X-Plex-Token=${token}`;
            // console.log(apiUrl)
            let retryCount = 0;
            const maxRetries = 100;
            while (retryCount < maxRetries) {
                try {
                    const response = await fetch(apiUrl, { timeout: 60000 });
                    if (!response.ok) {
                        throw new Error(`Erreur lors de la récupération des données pour la clé de notation ${ratingKeyValue}.`);
                    }
                    xml = await response.text();
                    break; // Sortir de la boucle si la requête réussit
                } catch (error) {
                    console.error(`Erreur lors de la récupération des données pour la clé de notation ${ratingKeyValue}:`, error.message);
                    retryCount++;
                    console.log(`Tentative ${retryCount} de récupération des données pour la clé de notation ${ratingKeyValue} dans 60 secondes...`);
                    await new Promise(resolve => setTimeout(resolve, 60000)); // Attendre 60 secondes avant de réessayer
                }
            }

            if (xml === null) {
                console.error(`Échec de la récupération des données pour la clé de notation ${ratingKeyValue} après ${maxRetries} tentatives.`);
                failedRatingKeys.push(ratingKeyValue); // Ajouter la ratingKey en échec au tableau
                continue; // Passer à la prochaine itération
            }

            // Parsing XML to JSON
            let jsonData;
            parseString(xml, (err, result) => {
                if (err) {
                    console.error('Erreur de parsing XML :', err);
                    return; // Sortir de la fonction en cas d'erreur de parsing
                }
                jsonData = result;
            });

            // Vérification des données JSON avant d'y accéder
            if (!jsonData || !jsonData.MediaContainer || !jsonData.MediaContainer.Video) {
                console.error('Données JSON non conformes ou manquantes.');
                continue; // Passer à la prochaine itération
            }

            // Extraction du GUID TVDB
            const tvdbGUID = jsonData.MediaContainer.Video[0]?.Guid?.find(guid => guid.$.id.startsWith('tvdb://'))?.$?.id;
            if (!tvdbGUID) {
                console.error('Impossible de trouver le GUID TVDB pour ce film.');
                failedRatingKeys.push(ratingKeyValue); // Ajouter la ratingKey en échec au tableau
                continue; // Passer à la prochaine itération
            }
            const tvdbID = tvdbGUID.split('tvdb://')[1];

            // Vérification des IDs existants
            if (fs.existsSync(MOVIES_DB_OLD_FILE_PATH)) {
                const existingIDsOld = fs.readFileSync(MOVIES_DB_OLD_FILE_PATH, 'utf8').split('\n');
                if (existingIDsOld.includes(tvdbID)) {
                    console.log(`ID ${tvdbID} déjà présent dans ${MOVIES_DB_OLD_FILE_PATH}. Ignoré.`);
                    continue; // Passer à la prochaine itération
                }
            }

            const existingIDs = fs.readFileSync(MOVIES_DB_FILE_PATH, 'utf8').split('\n');
            if (existingIDs.includes(tvdbID)) {
                console.log(`ID ${tvdbID} déjà présent dans ${MOVIES_DB_FILE_PATH}. Ignoré.`);
                continue; // Passer à la prochaine itération
            }

            // Stockage du TVDB ID dans SHOWS_DB_FILE_PATH
            fs.appendFileSync(MOVIES_DB_FILE_PATH, tvdbID + '\n');
            console.log(`ID ${tvdbID} ajouté à ${MOVIES_DB_FILE_PATH}.`);

            // Ajouter le GUID extrait au tableau
            extractedGUIDs.push(tvdbID);
        }

            // Stocker les ratingKeys en échec dans un fichier temporaire
            if (failedRatingKeys.length > 0) {
                if (!fs.existsSync(FAILED_RATINGKEY_FILE_PATH)) {
                    fs.writeFileSync(FAILED_RATINGKEY_FILE_PATH, '');
                }
                const existingFailedKeys = fs.readFileSync(FAILED_RATINGKEY_FILE_PATH, 'utf8').split('\n');
                const keysToAdd = failedRatingKeys.filter(key => !existingFailedKeys.includes(key));
                if (keysToAdd.length > 0) {
                    fs.appendFileSync(FAILED_RATINGKEY_FILE_PATH, keysToAdd.join('\n') + '\n');
                }
            }

        // Retourner les GUIDs extraits
        return extractedGUIDs;
    } catch (error) {
        console.error('Erreur lors de l\'extraction et du stockage du GUID TVDB :', error.message);
        // En cas d'erreur, retourner une tableau vide
        return [];
    }
}


// Fonction pour obtenir l'ID de la bibliothèque de films à partir de l'URL Plex
async function getMoviesLibraryId(plexConfig) {
    const response = await fetch(`http://${plexConfig.ip}:${plexConfig.port}/library/sections?X-Plex-Token=${plexConfig.token}`);
    if (!response.ok) {
        throw new Error('Erreur de connexion, vérifiez votre token et votre IP.');
    }
    const xml = await response.text();
    
    // Parsing XML to JSON
    let jsonData;
    parseString(xml, (err, result) => {
        if (err) throw err;
        jsonData = result;
    });

    // Extracting movie library ID
    const movieLibrary = jsonData?.MediaContainer?.Directory.find(directory => directory.$.type === 'movie');
    if (!movieLibrary) {
        throw new Error('La bibliothèque de films n\'a pas été trouvée.');
    }
    return movieLibrary.$.key;
}

// Fonction pour obtenir l'ID de la bibliothèque de séries TV à partir de l'URL Plex
async function getTvShowsLibraryId(plexConfig) {
    const response = await fetch(`http://${plexConfig.ip}:${plexConfig.port}/library/sections?X-Plex-Token=${plexConfig.token}`);
    if (!response.ok) {
        throw new Error('Erreur de connexion, vérifiez votre token et votre IP.');
    }
    const xml = await response.text();
    
    // Parsing XML to JSON
    let jsonData;
    parseString(xml, (err, result) => {
        if (err) throw err;
        jsonData = result;
    });

    // Extracting TV shows library ID
    const tvShowsLibrary = jsonData?.MediaContainer?.Directory.find(directory => directory.$.type === 'show');
    if (!tvShowsLibrary) {
        throw new Error('La bibliothèque de séries TV n\'a pas été trouvée.');
    }
    return tvShowsLibrary.$.key;
}

async function retrieveMedia() {
    return new Promise(async (resolve, reject) => {
        try {
            let plexConfig = readConfig();

            // Obtenir l'ID de la bibliothèque de films
            let libraryIdMovies;
            try {
                libraryIdMovies = await getMoviesLibraryId(plexConfig);
            } catch (error) {
                console.error('Erreur:', error.message);
                return reject(error); // Rejeter la promesse en cas d'erreur
            }

            // Obtenir l'ID de la bibliothèque de séries
            let libraryIdTvShows;
            try {
                libraryIdTvShows = await getTvShowsLibraryId(plexConfig);
            } catch (error) {
                console.error('Erreur:', error.message);
                return reject(error); // Rejeter la promesse en cas d'erreur
            }

            const moviesUrl = `http://${plexConfig.ip}:${plexConfig.port}/library/sections/${libraryIdMovies}/all?unwatched=0`;
            const tvShowsUrl = `http://${plexConfig.ip}:${plexConfig.port}/library/sections/${libraryIdTvShows}/all?unwatched=0&episode.viewCount=1&type=4`;

            try {
                await getMoviesTitles(moviesUrl, plexConfig.token, plexConfig);
            } catch (error) {
                console.error('Erreur:', error.message);
                return reject(error); // Rejeter la promesse en cas d'erreur
            }

            // Obtenir les GUIDs des épisodes de séries à partir de Plex
            try {
                await getShowsEpisodes(tvShowsUrl, plexConfig.token, plexConfig);
            } catch (error) {
                console.error('Erreur:', error.message);
                return reject(error); // Rejeter la promesse en cas d'erreur
            }
            resolve(); // Résoudre la promesse une fois que toutes les opérations sont terminées
        } catch (error) {
            reject(error); // Rejeter la promesse en cas d'erreur
        }
    });
}

module.exports = { retrieveMedia };