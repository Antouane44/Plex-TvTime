const { readConfig, connectToPlex, testTvTimeConnection } = require('./Auth');
const { retrieveMedia } = require('./PlexRetrieveMedia');
const { watchMoviesTvTime } = require('./TvTimeMovies');
const { watchShowsTvTime } = require('./TvTimeShows');
const { generateErrorReport } = require('./Report');

async function main() {
    let plexConfig = readConfig();

    try {
        plexConfig = await connectToPlex();
        console.log('Connexion avec le serveur Plex réussie.');

        } catch (error) {
        console.error('Une erreur s\'est produite lors de la connexion à Plex :', error.message);
    }

    await testTvTimeConnection();

    await retrieveMedia();

    await watchMoviesTvTime();

    await watchShowsTvTime();

    await generateErrorReport();

}

main();