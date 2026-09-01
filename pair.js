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
    try {
        fs.rmSync(FilePath, { recursive: true, force: true });
    } catch (e) {}
}

router.get("/", async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "Phone number is required" });

    // Project එක ඇතුලෙන්ම Dynamic Unique Session Folder එකක් හදනවා (Railway Permission Issue නැති කිරීමට)
    const sessionDir = path.join(__dirname, `./session_${Date.now()}`);

    try {
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        let MrNobodyWeb = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
            },
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }),
            browser: Browsers.ubuntu("Chrome"),
            syncFullHistory: false,
        });

        if (!MrNobodyWeb.authState.creds.registered) {
            await delay(2000);
            num = num.replace(/[^0-9]/g, "");
            const code = await MrNobodyWeb.requestPairingCode(num);
            if (!res.headersSent) {
                res.send({ code });
            }
        }

        MrNobodyWeb.ev.on("creds.update", saveCreds);

        MrNobodyWeb.ev.on("connection.update", async (s) => {
            const { connection, lastDisconnect } = s;

            if (connection === "open") {
                try {
                    await delay(5000);
                    const auth_path = path.join(sessionDir, "creds.json");
                    if (!fs.existsSync(auth_path)) return;

                    const credsData = fs.readFileSync(auth_path);
                    const string_session = "MrNobody~" + Buffer.from(credsData).toString("base64");
                    const user_jid = jidNormalizedUser(MrNobodyWeb.user.id);

                    const sid = `*MRNOBODY MD 💐*\n\n⚠️ ${string_session} ⚠️\n\n*This is your Session ID, copy this id and paste into config.js file*`;

                    await MrNobodyWeb.sendMessage(user_jid, { text: sid });
                    await MrNobodyWeb.sendMessage(user_jid, { text: string_session });
                    await MrNobodyWeb.sendMessage(user_jid, { text: `🛑 *Do not share this code with anyone* 🛑` });

                    console.log("Session generated and sent successfully!");

                    await delay(3000);
                    removeFile(sessionDir);
                } catch (e) {
                    console.error("Error inside connection open:", e);
                    removeFile(sessionDir);
                }
            } else if (connection === "close") {
                let reason = lastDisconnect?.error?.output?.statusCode;
                if (reason === 401) {
                    removeFile(sessionDir);
                }
            }
        });

    } catch (err) {
        console.error("MrNobodyPair error:", err);
        removeFile(sessionDir);
        if (!res.headersSent) {
            res.status(500).send({ error: "Service Unavailable" });
        }
    }
});

module.exports = router;
