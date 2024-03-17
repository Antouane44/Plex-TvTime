const {
    puppeteer,
    fs,
    fetch,
    CONFIG_FILE_PATH,
    MOVIES_DB_FILE_PATH,
    MOVIES_DB_OLD_FILE_PATH
} = require('./Variables.js');

async function watchMoviesTvTime() {
    let config = {};
    try {
        // Vérifier si le fichier CONFIG_FILE_PATH existe
        const data = await fs.readFileSync(CONFIG_FILE_PATH);
        // Si le fichier existe, fusionner les données avec les données existantes
        config = JSON.parse(data);
    } catch (error) {
        // En cas d'erreur, config sera un objet vide
        console.log(`Le fichier ${CONFIG_FILE_PATH} n'existe pas ou est vide.`);
    }

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto('https://app.tvtime.com/welcome?mode=auth');

    // Attente implicite de 5 secondes
    await sleep(5000);

    let initialJwtToken = null;
    for (let i = 1; i <= 3; i++) {
        // Pause de 5 secondes, plus 2 secondes supplémentaires pour chaque itération
        await sleep(5000 + (2000 * i));

        // Exécution de JavaScript dans le contexte de la page pour obtenir le jeton JWT
        initialJwtToken = await page.evaluate(() => {
            return window.localStorage.getItem('flutter.jwtToken');
        });

        // Si le jeton JWT est récupéré, sortir de la boucle
        if (initialJwtToken) {
            break;
        } else {
            console.warn("Impossible de récupérer le jeton JWT, nouvelle tentative...");
        }
    }

    console.log('Jeton JWT initial :', initialJwtToken);

    // Supprimer les guillemets en utilisant substring
    initialJwtToken = initialJwtToken.substring(1, initialJwtToken.length - 1);
    console.log('Jeton JWT modifié :', initialJwtToken);

    const credentials = {
        username: config.username,
        password: config.password
    };

    // Maintenant, exécuter la deuxième partie pour obtenir et enregistrer le jeton JWT
    const url = 'https://beta-app.tvtime.com/sidecar?o=https://auth.tvtime.com/v1/login';

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${initialJwtToken}`,
            'Content-Type': 'application/json',
            'Content-Length': JSON.stringify(credentials).length
        },
        body: JSON.stringify(credentials)
    });

    // Vérifier si response.data existe et que jwt_token n'est pas vide
    if (response.ok) {
        const responseData = await response.json();
        if (responseData.data && responseData.data.jwt_token) {
            const jwtToken = responseData.data.jwt_token;
            const jwtRefreshToken = responseData.data.jwt_refresh_token;
            console.log(`Jetons JWT mis à jour pour l'utilisateur ${config.username}:`);
            console.log(`jwt_token=${jwtToken}`);
            console.log(`jwt_refresh_token=${jwtRefreshToken}`);

            // Maintenant, exécuter la fonction watchMovies pour regarder l'épisode
            let moviesIds;
            try {
                const data = await fs.readFileSync(MOVIES_DB_FILE_PATH, 'utf8');
                // Diviser le contenu en lignes pour obtenir un tableau d'ID de films
                moviesIds = data.split('\n').filter(id => id.trim() !== ''); // Filtrer les lignes vides
            } catch (error) {
                console.error(`Erreur lors de la lecture du fichier ${MOVIES_DB_FILE_PATH} :`, error);
                return;
            }

            const responseshow = await watchMovies(jwtToken, moviesIds);

            // console.log(`Réponse de watchMovies : ${JSON.stringify(responseshow)}`);
        } else {
            console.log('Connexion échouée, veuillez vérifier vos identifiants');
            process.exit(1); // Arrêter l'exécution du script
        }
    } else {
        console.log(`Erreur lors de la requête : ${response.status} - ${response.statusText}`);
        process.exit(1); // Arrêter l'exécution du script
    }

    await browser.close();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function watchMovies(initialJwtToken, moviesIds) {
    const responses = [];
    for (const movieId of moviesIds) {
        const Searchurl = `https://app.tvtime.com/sidecar?o=https://search.tvtime.com/v1/search/movie&q=${movieId}`;

        const response = await fetch(Searchurl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${initialJwtToken}`,
                'Content-Type': 'application/json',
                //'locale': 'fr'
            }
        });

        const data = await response.json(); // Récupérer les données JSON de la réponse
        responses.push(data);
        const dataArray = data.data;

        for (const element of dataArray) {
            const name = element.id;
            // console.log(name);
            if (name == movieId) {
                const UUID = element.uuid;
                // console.log(UUID);
                const Watchurl = `https://beta-app.tvtime.com/sidecar?o=https://msapi.tvtime.com/prod/v1/tracking/${UUID}/watch`;

                await fetch(Watchurl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${initialJwtToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({}) // No credentials needed for watch endpoint
                });

                // console.log(WatchResponse);
                // Déplacer le movieId vers MOVIES_DB_OLD_FILE_PATH
                try {
                    // Lire le contenu de MOVIES_DB_FILE_PATH
                    await fs.readFileSync(MOVIES_DB_FILE_PATH, 'utf8');

                    // Supprimer l'épisode de MOVIES_DB_FILE_PATH
                    const existingMovies = (await fs.readFileSync(MOVIES_DB_FILE_PATH, 'utf8')).split('\n').filter(id => id.trim() !== '');
                    const filteredEpisodes = existingMovies.filter(id => id !== movieId);
                    await fs.writeFileSync(MOVIES_DB_FILE_PATH, filteredEpisodes.join('\n'));

                    // Ajouter le movieId dans MOVIES_DB_OLD_FILE_PATH
                    await fs.appendFileSync(MOVIES_DB_OLD_FILE_PATH, `${movieId}\n`);
                    console.log(`Film ${movieId} traité avec succès.`);
                } catch (error) {
                    console.error("Erreur lors de la mise à jour des fichiers de base de données :", error);
                }
                break;
            }
        }
    }

    return responses;
}

module.exports = { watchMoviesTvTime };