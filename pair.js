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

// ෆයිල් සහ ෆෝල්ඩර් ඉවත් කිරීමේ function එක
function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
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

            // Pairing Code එක ලබාගැනීම
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

                        // Mega Upload වෙනුවට creds.json එක Base64 බවට හැරවීම
                        const credsData = fs.readFileSync(auth_path);
                        const string_session = "MrNobody~" + Buffer.from(credsData).toString("base64");
                        const user_jid = jidNormalizedUser(MrNobodyWeb.user.id);

                        const sid = `*MRNOBODY MD 💐*\n\n⚠️ ${string_session} ⚠️\n\n*This is your Base64 Session ID, copy this id and paste into config.js file*`;
                        
                        // WhatsApp පණිවිඩ යැවීම
                        await MrNobodyWeb.sendMessage(user_jid, { text: sid });
                        await MrNobodyWeb.sendMessage(user_jid, { text: string_session });
                        await MrNobodyWeb.sendMessage(user_jid, { text: `🛑 *Do not share this code with anyone* 🛑` });

                        console.log("Session generated and sent successfully!");

                        await delay(2000);
                        removeFile(sessionDir);

                    } catch (e) {
                        console.error("Error during connection open logic:", e);
                    }
                } 
                
                else if (connection === "close") {
                    let reason = lastDisconnect?.error?.output?.statusCode;
                    if (reason !== 401) {
                        await delay(5000);
                        MrNobodyPair();
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
