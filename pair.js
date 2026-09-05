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

const {
    saveSession,
} = require("./session-store");

const router = express.Router();

function removeFile(filePath) {
    if (!fs.existsSync(filePath)) return;

    try {
        fs.rmSync(filePath, {
            recursive: true,
            force: true
        });
    } catch (error) {
        console.error("Cleanup error:", error.message);
    }
}

router.get("/", async (req, res) => {
    let num = req.query.number;

    if (!num) {
        return res.status(400).json({
            error: "WhatsApp number is required"
        });
    }

    num = String(num).replace(/[^0-9]/g, "");

    if (num.length < 10) {
        return res.status(400).json({
            error: "Invalid WhatsApp number"
        });
    }

    const sessionDir = path.join(
        __dirname,
        "pair_" +
        Date.now() +
        "_" +
        Math.floor(Math.random() * 1000000)
    );

    fs.mkdirSync(sessionDir, {
        recursive: true
    });

    let MrNobodyWeb;
    let finished = false;
    let pairingRequested = false;

    try {
        const {
            state,
            saveCreds
        } = await useMultiFileAuthState(sessionDir);

        MrNobodyWeb = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(
                    state.keys,
                    pino({
                        level: "fatal"
                    })
                )
            },

            printQRInTerminal: false,

            logger: pino({
                level: "fatal"
            }),

            browser: Browsers.macOS("Safari")
        });

        MrNobodyWeb.ev.on(
            "creds.update",
            saveCreds
        );

        MrNobodyWeb.ev.on(
            "connection.update",
            async (update) => {
                const {
                    connection,
                    lastDisconnect
                } = update;

                /*
                 * Request pairing code only after
                 * the WhatsApp socket is ready.
                 */
                if (
                    connection === "connecting" &&
                    !state.creds.registered &&
                    !pairingRequested
                ) {
                    pairingRequested = true;

                    try {
                        await delay(1000);

                        const code =
                            await MrNobodyWeb.requestPairingCode(
                                num
                            );

                        if (!res.headersSent) {
                            res.json({
                                code
                            });
                        }

                        console.log(
                            "Pairing code generated:",
                            code
                        );

                    } catch (error) {
                        console.error(
                            "Pairing code error:",
                            error
                        );

                        if (!res.headersSent) {
                            res.status(500).json({
                                error:
                                    "Failed to generate pairing code"
                            });
                        }

                        removeFile(sessionDir);

                        try {
                            MrNobodyWeb.end(
                                undefined
                            );
                        } catch {}
                    }
                }

                /*
                 * Successfully connected.
                 */
                if (
                    connection === "open" &&
                    !finished
                ) {
                    finished = true;

                    try {
                        /*
                         * Allow all authentication files
                         * to finish writing.
                         */
                        await delay(5000);

                        /*
                         * Save the COMPLETE Baileys
                         * authentication state.
                         */
                        const sessionId =
                            saveSession(
                                sessionDir
                            );

                        const stringSession =
                            "MrNobody~" +
                            sessionId;

                        const userJid =
                            jidNormalizedUser(
                                MrNobodyWeb.user.id
                            );

                        const imageUrl =
                            "https://raw.githubusercontent.com/MrUnknowner/mrnobody-pair/main/assets/logo.jpg";

                        const message =
                            `*🖤 MRNOBODY MD SESSION 🖤*\n\n` +
                            `✨ *Session Successfully Generated!*\n\n` +
                            `⚠️ *SESSION ID:*\n` +
                            `\`${stringSession}\`\n\n` +
                            `🛑 *NOTE:* Do not share this code with anyone.\n\n` +
                            `👨‍💻 *Developer:* Milshen Meghishnu\n` +
                            `📱 *Bot Name:* MrNobody MD`;

                        await MrNobodyWeb.sendMessage(
                            userJid,
                            {
                                image: {
                                    url: imageUrl
                                },
                                caption:
                                    message
                            }
                        );

                        await MrNobodyWeb.sendMessage(
                            userJid,
                            {
                                text:
                                    stringSession
                            }
                        );

                        console.log(
                            "Session ID generated:",
                            stringSession
                        );

                        await delay(2000);

                        removeFile(
                            sessionDir
                        );

                        try {
                            MrNobodyWeb.end(
                                undefined
                            );
                        } catch {}

                    } catch (error) {
                        console.error(
                            "Session generation error:",
                            error
                        );

                        removeFile(
                            sessionDir
                        );

                        try {
                            MrNobodyWeb.end(
                                undefined
                            );
                        } catch {}
                    }
                }

                /*
                 * Connection closed before login
                 * completed.
                 */
                if (
                    connection === "close" &&
                    !finished
                ) {
                    const reason =
                        lastDisconnect
                            ?.error
                            ?.output
                            ?.statusCode;

                    console.log(
                        "WhatsApp connection closed:",
                        reason
                    );

                    removeFile(
                        sessionDir
                    );
                }
            }
        );

    } catch (error) {
        console.error(
            "Pairing error:",
            error
        );

        removeFile(sessionDir);

        if (!res.headersSent) {
            res.status(503).json({
                error:
                    "Service Unavailable"
            });
        }

        try {
            if (MrNobodyWeb) {
                MrNobodyWeb.end(
                    undefined
                );
            }
        } catch {}
    }
});

module.exports = router;
