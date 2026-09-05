const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const pino = require("pino");
const QRCode = require("qrcode");

const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");

const { saveSessionFolder } = require("./session-store");

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;

    try {
        fs.rmSync(FilePath, { recursive: true, force: true });
    } catch (e) {}

    return true;
}

router.get("/", async (req, res) => {
    const id = Math.floor(Math.random() * 100000);
    const sessionDir = path.join(__dirname, "../session_qr_" + id);

    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }

    async function MrNobodyQR() {
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        try {
            const MrNobodyWeb = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(
                        state.keys,
                        pino({ level: "fatal" })
                    )
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }),
                browser: Browsers.macOS("Safari")
            });

            MrNobodyWeb.ev.on("creds.update", saveCreds);

            MrNobodyWeb.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect, qr } = s;

                if (qr && !res.headersSent) {
                    try {
                        const qrImage = await QRCode.toDataURL(qr);
                        res.send({ qr: qrImage });
                    } catch (err) {
                        res.send({ error: "QR Generation Failed" });
                    }
                }

                if (connection === "open") {
                    try {
                        await delay(5000);
                        await saveCreds();

                        const sessionId = await saveSessionFolder(sessionDir);
                        const string_session = "MrNobody~" + sessionId;
                        const user_jid = jidNormalizedUser(MrNobodyWeb.user.id);

                        const image_url =
                            "https://raw.githubusercontent.com/MrUnknowner/mrnobody-pair/main/assets/logo.jpg";

                        const msg_text =
                            `*🖤 MRNOBODY MD SESSION 🖤*\n\n` +
                            `✨ *Session Successfully Generated!*\n\n` +
                            `⚠️ *SESSION ID:*\n` +
                            `\`${string_session}\`\n\n` +
                            `🛑 *NOTE:* Do not share this code with anyone.\n` +
                            `👨‍💻 *Developer:* Milshen Meghishnu\n` +
                            `*📱 Bot Name:* MrNobody MD`;

                        await MrNobodyWeb.sendMessage(user_jid, {
                            image: { url: image_url },
                            caption: msg_text
                        });

                        await MrNobodyWeb.sendMessage(user_jid, {
                            text: string_session
                        });

                        console.log("Session ID generated:", string_session);

                        await delay(2000);
                        removeFile(sessionDir);
                    } catch (e) {
                        console.error("QR Session Error:", e);
                        removeFile(sessionDir);
                    }
                } else if (connection === "close") {
                    const reason = lastDisconnect?.error?.output?.statusCode;

                    if (reason !== 401) {
                        await delay(5000);
                        MrNobodyQR();
                    } else {
                        removeFile(sessionDir);
                    }
                }
            });
        } catch (err) {
            console.error("QR Error:", err);
            removeFile(sessionDir);

            if (!res.headersSent) {
                res.send({ error: "Service Unavailable" });
            }
        }
    }

    return await MrNobodyQR();
});

module.exports = router;