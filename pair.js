const express = require("express");
const fs = require("fs");
const path = require("path");
let router = express.Router();
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
} = require("@whiskeysockets/baileys");

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get("/", async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).json({ error: "Phone number is required" });

    const sessionDir = path.join(__dirname, `temp_${Date.now()}`);
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }

    let responded = false;

    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        let MrNobodySock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
            },
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }),
            browser: Browsers.macOS("Safari"),
        });

        if (!MrNobodySock.authState.creds.registered) {
            await delay(1500);
            num = num.replace(/[^0-9]/g, "");
            const code = await MrNobodySock.requestPairingCode(num);
            if (!responded) {
                responded = true;
                res.send({ code });
            }
        }

        MrNobodySock.ev.on("creds.update", saveCreds);

        MrNobodySock.ev.on("connection.update", async (s) => {
            const { connection, lastDisconnect } = s;

            if (connection === "open") {
                try {
                    await delay(5000);
                    const authPath = path.join(sessionDir, "creds.json");
                    if (!fs.existsSync(authPath)) return;

                    const credsData = fs.readFileSync(authPath);
                    const b64 = Buffer.from(credsData).toString("base64");
                    const sessionId = `MrNobody~${b64}`;
                    const userJid = jidNormalizedUser(MrNobodySock.user.id);

                    await MrNobodySock.sendMessage(userJid, {
                        text: `✅ *MRNOBBY-MD SESSION CONNECTED!*\n\n\`\`\`${sessionId}\`\`\`\n\n> 👨‍💻 Powered by MrNobody`,
                    });

                    await delay(2000);
                    removeFile(sessionDir);
                } catch (e) {
                    console.error("Error during connection open logic:", e);
                }
            } else if (connection === "close") {
                let reason = lastDisconnect?.error?.output?.statusCode;
                if (reason !== 401) {
                    await delay(5000);
                }
            }
        });

    } catch (err) {
        console.error("Pair error:", err);
        removeFile(sessionDir);
        if (!responded) {
            responded = true;
            res.status(500).send({ error: "Service Unavailable" });
        }
    }
});

module.exports = router;
