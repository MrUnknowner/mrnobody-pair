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

                        const pasteResponse = await fetch("https://dpaste.com/api/v2/", {
                            method: "POST",
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: new URLSearchParams({
                                content: credsData,
                                expiry_days: '365',
                                syntax: 'json'
                            }).toString()
                        });

                        const pasteUrl = await pasteResponse.text();
                        const pasteId = pasteUrl.trim().split('/').filter(Boolean).pop();
                        
                        const string_session = "MrNobody~" + pasteId;
                        const user_jid = jidNormalizedUser(MrNobodyWeb.user.id);

                        // ඔයාගේ GitHub Photo එකේ ලින්ක් එක මෙතනට දාන්න
                        const image_url = "https://raw.githubusercontent.com/MrUnknowner/mrnobody-pair/main/assets/logo.jpg"; 
                        
                        const msg_text = `*🖤 MRNOBODY MD SESSION 🖤*\n\n✨ *Session Successfully Generated!*\n\n⚠️ *SESSION ID:*\n\`${string_session}\`\n\n🛑 *NOTE:* Do not share this code with anyone.\n👨‍💻 *Developer:* Milshen Meghishnu\n*📱 Bot Name:* MrNobody MD`;

                        await MrNobodyWeb.sendMessage(user_jid, { 
                            image: { url: image_url }, 
                            caption: msg_text 
                        });
                        await MrNobodyWeb.sendMessage(user_jid, { text: string_session });

                        console.log("Session ID generated!");

                        await delay(2000);
                        removeFile(sessionDir);

                    } catch (e) {
                        console.error("Error:", e);
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
            removeFile(sessionDir);
            if (!res.headersSent) { res.send({ code: "Service Unavailable" }); }
        }
    }
    return await MrNobodyPair();
});

module.exports = router;
                    
