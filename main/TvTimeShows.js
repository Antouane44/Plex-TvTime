const {
    puppeteer,
    fs,
    fetch,
    readline,
    CONFIG_FILE_PATH,
    SHOWS_DB_FILE_PATH,
    SHOWS_DB_OLD_FILE_PATH,
    ERROR_TVSHOWS_FILE_PATH
} = require('./Variables.js');

async function watchShowsTvTime() {
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

    // Vérifier si le fichier contient les champs username et password
    if (!config.hasOwnProperty('username') || !config.hasOwnProperty('password')) {
        console.log(`Le fichier ${CONFIG_FILE_PATH} ne contient pas les champs attendus (username, password).`);
        console.log("Veuillez fournir vos identifiants :");
        const username = await askQuestion("Nom d'utilisateur TvTime : ");
        const password = await askQuestion("Mot de passe TvTime : ");
        // Ajouter les identifiants à la configuration
        config.username = username;
        config.password = password;
        // Enregistrer les identifiants dans le fichier CONFIG_FILE_PATH
        await fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2));
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

    const response = await page.evaluate(async (url, initialJwtToken, credentials) => {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${initialJwtToken}`,
                'Content-Type': 'application/json',
                'Content-Length': JSON.stringify(credentials).length
            },
            body: JSON.stringify(credentials)
        });
        return await response.json();
    }, url, initialJwtToken, credentials);

    // Vérifier si response.data existe et que jwt_token n'est pas vide
    if (response.data && response.data.jwt_token) {
        const jwtToken = response.data.jwt_token;
        const jwtRefreshToken = response.data.jwt_refresh_token;
        console.log(`Jetons JWT mis à jour pour l'utilisateur ${credentials.username}:`);
        console.log(`jwt_token=${jwtToken}`);
        console.log(`jwt_refresh_token=${jwtRefreshToken}`);

        // Maintenant, exécuter la fonction watchEpisodes pour regarder l'épisode

        let episodeIds;
        try {
            const data = await fs.readFileSync(SHOWS_DB_FILE_PATH, 'utf8');
            // Diviser le contenu en lignes pour obtenir un tableau d'ID d'épisode
            episodeIds = data.split('\n').filter(id => id.trim() !== ''); // Filtrer les lignes vides
        } catch (error) {
            console.error(`Erreur lors de la lecture du fichier ${SHOWS_DB_FILE_PATH} :`, error);
            return;
        }
        const responseshow = await watchEpisodes(jwtToken, episodeIds, credentials);

        // console.log(`Réponse de watchEpisodes : ${JSON.stringify(responseshow)}`);
    } else {
        console.log('Connexion échouée, veuillez vérifier vos identifiants');
        process.exit(1); // Arrêter l'exécution du script
    }

    await browser.close();
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function askQuestion(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function watchEpisodes(initialJwtToken, episodeIds, credentials) {
    const responses = [];
    for (const episodeId of episodeIds) {
        let success = false;
        while (!success) {
            try {
                const url = `https://beta-app.tvtime.com/sidecar?o=https://api2.tozelabs.com/v2/watched_episodes/episode/${episodeId}&is_rewatch=0`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${initialJwtToken}`,
                        'Content-Type': 'application/json',
                        'Content-Length': JSON.stringify(credentials).length
                    },
                    body: JSON.stringify(credentials)
                });

                if (!response.ok) {
                    if (response.status === 404) {
                        // Vérifier l'existence du fichier SHOWS_DB_OLD_FILE_PATH
                        try {
                            await fs.access(ERROR_TVSHOWS_FILE_PATH);
                        } catch (error) {
                            // Si le fichier n'existe pas, le créer
                            await fs.writeFileSync(ERROR_TVSHOWS_FILE_PATH, '');
                        }
                        // Vérifier si l'episodeId est déjà dans ERROR_TVSHOWS_FILE_PATH
                        const existingEpisodesErr = (await fs.readFileSync(ERROR_TVSHOWS_FILE_PATH, 'utf8')).split('\n').filter(id => id.trim() !== '');
                        if (!existingEpisodesErr.includes(episodeId)) {
                            console.error(`Échec de la tentative de regarder l'épisode ${episodeId}: Ressource non trouvée`);
                            // Stocker l'episodeId dans le fichier ERROR_TVSHOWS_FILE_PATH
                            await fs.appendFileSync(ERROR_TVSHOWS_FILE_PATH, `${episodeId}\n`);
                        } else {
                            console.log(`Épisode ${episodeId} a déjà été signalé comme introuvable.`);
                        }
			// Supprimer l'épisode de SHOWS_DB_FILE_PATH
			const existingEpisodes = (await fs.readFileSync(SHOWS_DB_FILE_PATH, 'utf8')).split('\n').filter(id => id.trim() !== '');
			const filteredEpisodes = existingEpisodes.filter(id => id !== episodeId);
			await fs.writeFileSync(SHOWS_DB_FILE_PATH, filteredEpisodes.join('\n'));
                        break; // Sortir de la boucle while en cas d'erreur 404
                    } else {
                        throw new Error(`Fetch failed with status ${response.status}`);
                    }
                }

                const jsonResponse = await response.json();
                responses.push(jsonResponse);
                success = jsonResponse;
                if (success) {
                    console.log(`Épisode ${episodeId} regardé avec succès.`);
                    
                    // Supprimer l'épisode de SHOWS_DB_FILE_PATH
                    const existingEpisodes = (await fs.readFileSync(SHOWS_DB_FILE_PATH, 'utf8')).split('\n').filter(id => id.trim() !== '');
                    const filteredEpisodes = existingEpisodes.filter(id => id !== episodeId);
                    await fs.writeFileSync(SHOWS_DB_FILE_PATH, filteredEpisodes.join('\n'));
                
                    // Vérifier l'existence du fichier SHOWS_DB_OLD_FILE_PATH
                    try {
                        await fs.accessSync(SHOWS_DB_OLD_FILE_PATH);
                    } catch (error) {
                        // Si le fichier n'existe pas, le créer
                        await fs.writeFileSync(SHOWS_DB_OLD_FILE_PATH, '');
                    }

                    // Ajouter l'épisode à SHOWS_DB_OLD_FILE_PATH s'il n'est pas déjà présent
                    const existingEpisodesOld = (await fs.readFileSync(SHOWS_DB_OLD_FILE_PATH, 'utf8')).split('\n').filter(id => id.trim() !== '');
                    if (!existingEpisodesOld.includes(episodeId)) {
                        await fs.appendFileSync(SHOWS_DB_OLD_FILE_PATH, episodeId + '\n');
                    }
                }
            } catch (error) {
                console.error(`Erreur lors de la tentative de regarder l'épisode ${episodeId} :`, error);
            }
        }

    }
    return responses;
}

module.exports = { watchShowsTvTime };
