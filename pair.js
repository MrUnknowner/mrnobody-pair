const express = require("express");
const fs = require("fs");
const path = require("path");
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
} = require("@whiskeysockets/baileys");

const router = express.Router();

function clearFolder(folderPath) {
    if (fs.existsSync(folderPath)) {
        try { fs.rmSync(folderPath, { recursive: true, force: true }); } catch (e) {}
    }
}

router.get("/", async (req, res) => {
    let phoneNum = req.query.number;
    if (!phoneNum) return res.status(400).send({ error: "Phone number required" });

    const sessionFolder = path.join(__dirname, `../session_${Date.now()}`);

    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);

        const client = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
            },
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }),
            browser: Browsers.macOS("Safari"),
            syncFullHistory: false
        });

        if (!client.authState.creds.registered) {
            await delay(1500);
            phoneNum = phoneNum.replace(/[^0-9]/g, "");
            const code = await client.requestPairingCode(phoneNum);
            
            if (!res.headersSent) {
                return res.send({ code: code?.match(/.{1,4}/g)?.join("-") || code });
            }
        }

        client.ev.on("creds.update", saveCreds);

        client.ev.on("connection.update", async (update) => {
            const { connection } = update;

            if (connection === "open") {
                try {
                    await delay(4000);
                    const authPath = path.join(sessionFolder, "creds.json");

                    if (fs.existsSync(authPath)) {
                        const credsData = fs.readFileSync(authPath);
                        const sessionID = "MrNobody~" + Buffer.from(credsData).toString("base64");
                        const userJid = jidNormalizedUser(client.user.id);

                        const msg = `*🖤 MRNOBODY MD SESSION CONNECTED 🖤*\n\n\`\`\`${sessionID}\`\`\`\n\n> Keep this ID safe!`;

                        await client.sendMessage(userJid, { text: msg });
                        await client.sendMessage(userJid, { text: sessionID });
                    }

                    await delay(2000);
                    clearFolder(sessionFolder);
                } catch (err) {
                    clearFolder(sessionFolder);
                }
            } else if (connection === "close") {
                clearFolder(sessionFolder);
            }
        });

    } catch (error) {
        clearFolder(sessionFolder);
        if (!res.headersSent) {
            res.status(500).send({ error: "Service Unavailable" });
        }
    }
});

module.exports = router;
