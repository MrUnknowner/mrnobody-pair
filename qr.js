const express = require("express");
const fs = require("fs");
const path = require("path");
const pino = require("pino");
const QRCode = require("qrcode");

const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
} = require("@whiskeysockets/baileys");

const {
    saveSession
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
        console.error(
            "Cleanup error:",
            error.message
        );
    }
}

router.get("/", async (req, res) => {

    /*
     * Every QR request gets its own
     * temporary authentication folder.
     */
    const sessionDir = path.join(
        __dirname,
        "qr_" +
        Date.now() +
        "_" +
        Math.floor(Math.random() * 1000000)
    );

    fs.mkdirSync(sessionDir, {
        recursive: true
    });

    let MrNobodyWeb;
    let finished = false;

    try {

        const {
            state,
            saveCreds
        } = await useMultiFileAuthState(
            sessionDir
        );

        MrNobodyWeb = makeWASocket({
            auth: {
                creds: state.creds,

                keys:
                    makeCacheableSignalKeyStore(
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

            browser:
                Browsers.macOS(
                    "Safari"
                )
        });

        /*
         * VERY IMPORTANT:
         * Save creds AND all Signal keys.
         */
        MrNobodyWeb.ev.on(
            "creds.update",
            saveCreds
        );

        MrNobodyWeb.ev.on(
            "connection.update",
            async (update) => {

                const {
                    connection,
                    lastDisconnect,
                    qr
                } = update;

                /*
                 * Send QR to frontend.
                 *
                 * Frontend still receives:
                 * { qr: "data:image/..." }
                 */
                if (
                    qr &&
                    !res.headersSent
                ) {
                    try {

                        const qrImage =
                            await QRCode.toDataURL(
                                qr
                            );

                        res.json({
                            qr: qrImage
                        });

                        console.log(
                            "QR code generated."
                        );

                    } catch (error) {

                        console.error(
                            "QR generation error:",
                            error
                        );

                        if (
                            !res.headersSent
                        ) {
                            res.status(500).json({
                                error:
                                    "QR Generation Failed"
                            });
                        }

                        removeFile(
                            sessionDir
                        );
                    }
                }

                /*
                 * WhatsApp successfully connected.
                 */
                if (
                    connection === "open" &&
                    !finished
                ) {
                    finished = true;

                    try {

                        /*
                         * Wait until Baileys has
                         * finished writing the
                         * complete auth state.
                         */
                        await delay(5000);

                        /*
                         * Save EVERYTHING:
                         *
                         * creds.json
                         * pre-keys
                         * sender keys
                         * app-state keys
                         * etc.
                         */
                        const sessionId =
                            saveSession(
                                sessionDir
                            );

                        /*
                         * Keep the same format
                         * your bot expects.
                         */
                        const stringSession =
                            "MrNobody~" +
                            sessionId;

                        const userJid =
                            jidNormalizedUser(
                                MrNobodyWeb
                                    .user
                                    .id
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

                        /*
                         * Session is safely stored
                         * in /sessions now.
                         */
                        await delay(2000);

                        removeFile(
                            sessionDir
                        );

                        /*
                         * Close temporary QR
                         * connection.
                         */
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
                 * Connection closed before
                 * session generation finished.
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

                    /*
                     * Don't create another
                     * socket using the same
                     * HTTP request.
                     */
                    removeFile(
                        sessionDir
                    );
                }
            }
        );

    } catch (error) {

        console.error(
            "QR error:",
            error
        );

        removeFile(
            sessionDir
        );

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
