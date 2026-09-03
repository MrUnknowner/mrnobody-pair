const express = require("express");
const fs = require("fs");
const path = require("path");
let router = express.Router();
const pino = require("pino");
const axios = require("axios");
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
    try { fs.rmSync(FilePath, { recursive: true, force: true }); } catch (e) {}
}

router.get("/", async (req, res) => {
    let num = req.query.number;

    const sessionDir = path.join(__dirname, '../session');
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }

    async function MrNobodyPair() {
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        try {
            let MrNobodyWeb = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
            });

            if (!MrNobodyWeb.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, "");
                const code = await MrNobodyWeb.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
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

                        const credsData = fs.readFileSync(auth_path, "utf-8");

                        // creds.json එක Pastebin server එකකට upload කරලා Short Key එකක් සාදාගැනීම
                        const pasteResponse = await axios.post("https://dpaste.com/api/v2/", 
                            new URLSearchParams({
                                content: credsData,
                                expiry_days: '365',
                                syntax: 'json'
                            }).toString(),
                            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
                        );

                        const pasteUrl = pasteResponse.data.trim();
                        const pasteId = pasteUrl.split('/').filter(Boolean).pop(); // උදා: X9A2M1
                        
                        // ඉතාම කෙටි Session ID එක
                        const string_session = "MrNobody~" + pasteId;
                        const user_jid = jidNormalizedUser(MrNobodyWeb.user.id);

                        const sid = `*🖤 MRNOBODY MD SESSION 🖤*\n\n⚠️ ${string_session} ⚠️\n\n*This is your Short Session ID!*`;
                        
                        await MrNobodyWeb.sendMessage(user_jid, { text: sid });
                        await MrNobodyWeb.sendMessage(user_jid, { text: string_session });
                        await MrNobodyWeb.sendMessage(user_jid, { text: `🛑 *Do not share this code with anyone* 🛑` });

                        console.log("Short Session ID generated:", string_session);

                        await delay(2000);
                        removeFile(sessionDir);

                    } catch (e) {
                        console.error("Error during upload or messaging:", e);
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
            console.error("MrNobodyPair error:", err);
            removeFile(sessionDir);
            if (!res.headersSent) {
                res.send({ code: "Service Unavailable" });
            }
        }
    }

    return await MrNobodyPair();
});

module.exports = router;
