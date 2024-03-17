const {
    puppeteer,
    fs,
    fetch,
    readline,
    CONFIG_FILE_PATH
} = require('./Variables.js');

// Fonction pour lire la configuration depuis le fichier CONFIG_FILE_PATH
function readConfig() {
    try {
        const configFile = fs.readFileSync(CONFIG_FILE_PATH);
        return JSON.parse(configFile);
    } catch (error) {
        return {};
    }
}

// Fonction pour demander à l'utilisateur de saisir le token Plex, l'IP et le port du serveur Plex
async function askForPlexConfig() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question('Entrez votre token Plex, le token peut-être récupéré ici https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token : ', (token) => {
            rl.question('Entrez l\'IP de votre serveur Plex : ', (ip) => {
                rl.question('Entrez le port de votre serveur Plex : ', (port) => {
                    rl.close();
                    resolve({ token, ip, port });
                });
            });
        });
    });
}

// Fonction pour enregistrer la configuration dans le fichier CONFIG_FILE_PATH
function saveConfig(config) {
    try {
        const existingConfig = readConfig();
        const mergedConfig = { ...existingConfig, ...config };
        fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(mergedConfig, null, 2));
        console.log('Configuration enregistrée avec succès.');
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement de la configuration :', error.message);
    }
}

async function connectToPlex() {
    let plexConfig = readConfig();
    let connectionSuccessful = false;

    while (!connectionSuccessful) {
        if (plexConfig && plexConfig.token && plexConfig.ip && plexConfig.port) {
            try {
                const testUrl = `http://${plexConfig.ip}:${plexConfig.port}/library/sections?X-Plex-Token=${plexConfig.token}`;
                const response = await fetch(testUrl);
                if (!response.ok) {
                    console.log('Erreur de connexion avec les informations de connexion actuelles.');
                    plexConfig = await askForPlexConfig();
                    continue;
                }
                connectionSuccessful = true;
            } catch (error) {
                console.error('Erreur lors de la tentative de connexion :', error.message);
                plexConfig = await askForPlexConfig();
            }
        } else {
            plexConfig = await askForPlexConfig();
        }
    }

    if (plexConfig.token && plexConfig.ip && plexConfig.port) {
        saveConfig(plexConfig);
    }

    return plexConfig;
}

async function testTvTimeConnection() {
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

    let authenticated = false;
    while (!authenticated) {
        // Vérifier si le fichier contient les champs username et password
        if (!config.hasOwnProperty('username') || !config.hasOwnProperty('password')) {
            console.log(`Le fichier ${CONFIG_FILE_PATH} ne contient pas les champs attendus (username, password).`);
            console.log("Veuillez fournir vos identifiants :");
            const username = await askQuestion("Nom d'utilisateur TvTime : ");
            const password = await askQuestion("Mot de passe TvTime : ");
            // Ajouter les identifiants à la configuration
            config.username = username;
            config.password = password;
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

        //console.log('Jeton JWT initial :', initialJwtToken);

        // Supprimer les guillemets en utilisant substring
        initialJwtToken = initialJwtToken.substring(1, initialJwtToken.length - 1);
        //console.log('Jeton JWT modifié :', initialJwtToken);

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
                // console.log(`Jetons JWT mis à jour pour l'utilisateur ${config.username}:`);
                // console.log(`jwt_token=${jwtToken}`);
                // console.log(`jwt_refresh_token=${jwtRefreshToken}`);
                console.log('Connexion avec TvTime en succès, enregistrement de la configuration.');
                await fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2));
                authenticated = true;
            } else {
                console.log('Connexion échouée, veuillez vérifier vos identifiants');
            }
        } else {
            console.log(`Erreur lors de la requête : ${response.status} - ${response.statusText}`);
            config = {}; // Réinitialiser les identifiants en cas d'échec de connexion
        }

        await browser.close();
    }
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { readConfig, connectToPlex, testTvTimeConnection };