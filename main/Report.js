const {
    fs,
    MOVIES_DB_FILE_PATH,
    ERROR_TVSHOWS_FILE_PATH,
    FAILED_RATINGKEY_FILE_PATH
} = require('./Variables.js');

async function generateErrorReport() {
    try {
        if (fs.existsSync(ERROR_TVSHOWS_FILE_PATH)) {
            const errorTvShowsData = fs.readFileSync(ERROR_TVSHOWS_FILE_PATH, 'utf-8');
            const errorTvShowsCount = errorTvShowsData.trim().split('\n').length;
            console.log(`Les épisodes suivants n'ont pas été trouvés sur TvTime. \nNombre d'erreurs dans ${ERROR_TVSHOWS_FILE_PATH}: ${errorTvShowsCount}\n`);
        } else {
            console.log(`Aucune erreur dans ${ERROR_TVSHOWS_FILE_PATH}\n`);
        }

        if (fs.existsSync(MOVIES_DB_FILE_PATH)) {
            const moviesDbData = fs.readFileSync(MOVIES_DB_FILE_PATH, 'utf-8');
            const moviesDbErrorsCount = moviesDbData.trim().split('\n').length;
            console.log(`Les films suivants n'ont pas été trouvés sur TvTime. \nNombre d'erreurs dans ${MOVIES_DB_FILE_PATH}: ${moviesDbErrorsCount}\n`);
        } else {
            console.log(`Aucune erreur dans ${MOVIES_DB_FILE_PATH}\n`);
        }

        if (fs.existsSync(FAILED_RATINGKEY_FILE_PATH)) {
            const failedRatingKeysData = fs.readFileSync(FAILED_RATINGKEY_FILE_PATH, 'utf-8');
            const failedRatingKeysCount = failedRatingKeysData.trim().split('\n').length;
            console.log(`Pour les médias concernés, il est généralement nécessaire de rafraîchir les métadonnées depuis Plex. \nNombre d'erreurs dans ${FAILED_RATINGKEY_FILE_PATH}: ${failedRatingKeysCount}\n`);
        } else {
            console.log(`Aucune erreur dans ${FAILED_RATINGKEY_FILE_PATH}\n`);
        }
    } catch (error) {
        console.error('Une erreur est survenue lors de la lecture des fichiers :', error);
    }
}

module.exports = { generateErrorReport };