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
    DisconnectReason
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
            browser: Browsers.macOS("Safari"),
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        });

        if (!MrNobodyWeb.authState.creds.registered) {
            await delay(1500);
            num = num.replace(/[^0-9]/g, "");
            const rawCode = await MrNobodyWeb.requestPairingCode(num);
            const code = rawCode?.match(/.{1,4}/g)?.join("-") || rawCode;

            if (!res.headersSent) {
                return res.send({ code });
            }
        }

        MrNobodyWeb.ev.on("creds.update", saveCreds);

        MrNobodyWeb.ev.on("connection.update", async (s) => {
            const { connection, lastDisconnect } = s;

            if (connection === "open") {
                console.log("Connection opened! Sending Session ID...");
                
                // Connection එක Open වුණාට පසු creds ලියවෙන තෙක් තත්පර 6ක් රැඳී සිටීම
                await delay(6000);
                
                try {
                    const auth_path = path.join(sessionDir, "creds.json");

                    if (fs.existsSync(auth_path)) {
                        const credsData = fs.readFileSync(auth_path);
                        const string_session = "MrNobody~" + Buffer.from(credsData).toString("base64");
                        const user_jid = jidNormalizedUser(MrNobodyWeb.user.id);

                        const sid = `*MRNOBODY MD 💐*\n\n⚠️ ${string_session} ⚠️\n\n*This is your Session ID, copy this id and paste into config.js file*`;

                        await MrNobodyWeb.sendMessage(user_jid, { text: sid });
                        await MrNobodyWeb.sendMessage(user_jid, { text: string_session });
                        await MrNobodyWeb.sendMessage(user_jid, { text: `🛑 *Do not share this code with anyone* 🛑` });

                        console.log("Session ID successfully generated and sent to WhatsApp!");
                    }

                    await delay(3000);
                    removeFile(sessionDir);

                } catch (e) {
                    console.error("Error during sending session:", e);
                    removeFile(sessionDir);
                }
            } else if (connection === "close") {
                let reason = lastDisconnect?.error?.output?.statusCode;
                console.log(`Connection closed with status code: ${reason}`);

                // 401 (Logged Out) නොවේ නම් පමණක් CleanUp කරන්න
                if (reason === DisconnectReason.loggedOut || reason === 401) {
                    removeFile(sessionDir);
                }
            }
        });

    } catch (err) {
        console.error("MrNobody Pair Error:", err);
        removeFile(sessionDir);
        if (!res.headersSent) {
            res.status(500).send({ error: "Service Unavailable" });
        }
    }
});

module.exports = router;
