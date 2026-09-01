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
    if (!num) return res.status(400).send({ error: "Number is required" });

    const sessionDir = path.join(__dirname, '../session');
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }

    async function MrNobodyPair() {
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        try {
            let MrNobodySock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
                syncFullHistory: false
            });

            if (!MrNobodySock.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, "");
                const rawCode = await MrNobodySock.requestPairingCode(num);
                const code = rawCode?.match(/.{1,4}/g)?.join("-") || rawCode;
                
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            MrNobodySock.ev.on("creds.update", saveCreds);

            MrNobodySock.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    try {
                        await delay(5000);
                        const auth_path = path.join(sessionDir, "creds.json");
                        
                        if (fs.existsSync(auth_path)) {
                            const credsData = fs.readFileSync(auth_path);
                            const string_session = "MrNobody~" + Buffer.from(credsData).toString("base64");
                            const user_jid = jidNormalizedUser(MrNobodySock.user.id);

                            const sid = `*MRNOBODY MD 💐*\n\n⚠️ ${string_session} ⚠️\n\n*This is your Session ID, copy this id and paste into config.js file*`;
                            
                            await MrNobodySock.sendMessage(user_jid, { text: sid });
                            await MrNobodySock.sendMessage(user_jid, { text: string_session });
                            await MrNobodySock.sendMessage(user_jid, { text: `🛑 *Do not share this code with anyone* 🛑` });

                            console.log("Session uploaded and sent successfully!");
                        }

                        await delay(2000);
                        removeFile(sessionDir);

                    } catch (e) {
                        console.error("Error during connection open logic:", e);
                        removeFile(sessionDir);
                    }
                } 
                else if (connection === "close") {
                    let reason = lastDisconnect?.error?.output?.statusCode;
                    if (reason !== 401) {
                        await delay(5000);
                        MrNobodyPair();
                    } else {
                        removeFile(sessionDir);
                    }
                }
            });

        } catch (err) {
            console.error("Pairing error:", err);
            removeFile(sessionDir);
            if (!res.headersSent) {
                res.status(500).send({ error: "Service Unavailable" });
            }
        }
    }

    return await MrNobodyPair();
});

module.exports = router;
