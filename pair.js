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
    if (!num) return res.status(400).json({ error: "Phone number is required" });

    // Zanta එකේ වගේම session ෆෝල්ඩර් එක සෑදීම
    const sessionDir = path.join(__dirname, `session_${Date.now()}`);
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
                browser: Browsers.macOS("Safari"), // Zanta එකේ වැඩ කරපු Safari browser එකමයි
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
                        await delay(5000); // creds.json ලියවෙන්න ටිකක් වෙලා දෙනවා
                        
                        const auth_path = path.join(sessionDir, "creds.json");
                        if (!fs.existsSync(auth_path)) return;

                        // Mega වෙනුවට කෙලින්ම Base64 හදාගැනීම
                        const credsData = fs.readFileSync(auth_path);
                        const b64 = Buffer.from(credsData).toString("base64");
                        const sessionId = `MrNobody~${b64}`;
                        
                        const user_jid = jidNormalizedUser(MrNobodyWeb.user.id);

                        // WhatsApp එකට Session ID එක එවයි
                        await MrNobodyWeb.sendMessage(user_jid, {
                            text: `✅ *MRNOBBY-MD SESSION CONNECTED!*\n\n\`\`\`${sessionId}\`\`\`\n\n> 👨‍💻 Powered by MrNobody`,
                        });

                        await MrNobodyWeb.sendMessage(user_jid, { text: sessionId });
                        await MrNobodyWeb.sendMessage(user_jid, { text: `🛑 *Do not share this code with anyone* 🛑` });

                        console.log("MrNobody Session generated and sent successfully!");

                        // Cleanup කිරීම
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
