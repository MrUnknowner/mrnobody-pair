const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
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

const {
    saveSession
} = require("./session-store");

const router = express.Router();

function removeFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return;
    }

    try {
        fs.rmSync(filePath, {
            recursive: true,
            force: true
        });
    } catch (error) {
        console.error(
            "Remove error:",
            error.message
        );
    }
}

function createSessionId() {
    return `MrNobody~${crypto.randomBytes(18).toString("base64url")}`;
}

router.get("/", async (req, res) => {
    let number = req.query.number;

    if (!number) {
        return res.status(400).send({
            error: "Phone number is required"
        });
    }

    /*
     * WhatsApp pairing requires digits only
     * with country code.
     */
    number = String(number).replace(
        /[^0-9]/g,
        ""
    );

    if (number.length < 8) {
        return res.status(400).send({
            error: "Invalid phone number"
        });
    }

    const temporarySessionId =
        crypto.randomBytes(12).toString("hex");

    const sessionDir = path.join(
        __dirname,
        `../session_${temporarySessionId}`
    );

    fs.mkdirSync(sessionDir, {
        recursive: true
    });

    let socket = null;
    let pairingRequested = false;
    let sessionSaved = false;

    try {
        const {
            state,
            saveCreds
        } = await useMultiFileAuthState(
            sessionDir
        );

        socket = makeWASocket({
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

            logger: pino({
                level: "fatal"
            }),

            printQRInTerminal: false,

            browser:
                Browsers.macOS("Safari")
        });

        /*
         * ALWAYS save credential updates.
         */
        socket.ev.on(
            "creds.update",
            saveCreds
        );

        /*
         * Connection lifecycle.
         *
         * IMPORTANT:
         * The listener is registered BEFORE
         * requesting the pairing code.
         */
        socket.ev.on(
            "connection.update",
            async (update) => {
                const {
                    connection,
                    lastDisconnect
                } = update;

                /*
                 * Request pairing code when the
                 * WhatsApp socket starts connecting.
                 */
                if (
                    connection === "connecting" &&
                    !state.creds.registered &&
                    !pairingRequested
                ) {
                    pairingRequested = true;

                    try {
                        /*
                         * Small delay gives the socket
                         * time to initialize.
                         */
                        await delay(1500);

                        const code =
                            await socket.requestPairingCode(
                                number
                            );

                        console.log(
                            "🔗 Pairing code generated:",
                            code
                        );

                        if (!res.headersSent) {
                            res.send({
                                code
                            });
                        }

                    } catch (error) {
                        console.error(
                            "❌ Pairing code error:",
                            error
                        );

                        if (!res.headersSent) {
                            res.status(503).send({
                                error:
                                    "Failed to generate pairing code"
                            });
                        }

                        removeFile(
                            sessionDir
                        );
                    }
                }

                /*
                 * WhatsApp login completed.
                 */
                if (
                    connection === "open" &&
                    !sessionSaved
                ) {
                    sessionSaved = true;

                    try {
                        console.log(
                            "✅ WhatsApp pairing successful."
                        );

                        /*
                         * Wait for the latest auth
                         * files to be written.
                         */
                        await delay(5000);

                        /*
                         * Save the latest credentials.
                         */
                        await saveCreds();

                        /*
                         * Verify that Baileys created
                         * the complete auth state.
                         */
                        const files =
                            fs.readdirSync(
                                sessionDir
                            );

                        if (!files.length) {
                            throw new Error(
                                "Session files were not created"
                            );
                        }

                        console.log(
                            "📁 Auth files:",
                            files.length
                        );

                        /*
                         * Create public Session ID.
                         */
                        const generatedSession =
                            createSessionId();

                        /*
                         * IMPORTANT:
                         * Store the COMPLETE Baileys
                         * auth directory.
                         */
                        const storedPath =
                            saveSession(
                                generatedSession,
                                sessionDir
                            );

                        if (
                            !storedPath ||
                            !fs.existsSync(
                                storedPath
                            )
                        ) {
                            throw new Error(
                                "Failed to store session"
                            );
                        }

                        console.log(
                            "✅ Full session state stored:",
                            generatedSession
                        );

                        /*
                         * Send Session ID while the
                         * temporary socket is still alive.
                         */
                        const userJid =
                            jidNormalizedUser(
                                socket.user.id
                            );

                        const imageUrl =
                            "https://raw.githubusercontent.com/MrUnknowner/mrnobody-pair/main/assets/logo.jpg";

                        const message =
`*🖤 MRNOBODY MD SESSION 🖤*

✨ *Session Successfully Generated!*

⚠️ *SESSION ID:*
\`${generatedSession}\`

🛑 *NOTE:* Do not share this code with anyone.

👨‍💻 *Developer:* Milshen Meghishnu
📱 *Bot Name:* MrNobody MD`;

                        await socket.sendMessage(
                            userJid,
                            {
                                image: {
                                    url: imageUrl
                                },
                                caption: message
                            }
                        );

                        await socket.sendMessage(
                            userJid,
                            {
                                text:
                                    generatedSession
                            }
                        );

                        console.log(
                            "✅ Session ID sent successfully."
                        );

                        /*
                         * Close the temporary socket
                         * AFTER the session has been
                         * copied and messages sent.
                         */
                        try {
                            socket.end(
                                new Error(
                                    "Temporary pairing session completed"
                                )
                            );
                        } catch (error) {
                            console.error(
                                "Socket close error:",
                                error.message
                            );
                        }

                        /*
                         * Only now remove the temporary
                         * auth directory.
                         */
                        await delay(1000);

                        removeFile(
                            sessionDir
                        );

                        console.log(
                            "🗑️ Temporary session removed."
                        );

                    } catch (error) {
                        sessionSaved = false;

                        console.error(
                            "❌ Session generation error:",
                            error
                        );

                        removeFile(
                            sessionDir
                        );
                    }
                }

                /*
                 * Connection closed.
                 */
                if (
                    connection === "close"
                ) {
                    const reason =
                        lastDisconnect
                            ?.error
                            ?.output
                            ?.statusCode;

                    console.log(
                        "⚠️ WhatsApp connection closed:",
                        reason
                    );

                    /*
                     * If session was successfully
                     * stored, don't reconnect.
                     */
                    if (sessionSaved) {
                        console.log(
                            "✅ Session already stored."
                        );

                        return;
                    }

                    /*
                     * Logged out / invalid session.
                     */
                    if (
                        reason ===
                        DisconnectReason.loggedOut
                    ) {
                        console.log(
                            "❌ WhatsApp session logged out."
                        );

                        removeFile(
                            sessionDir
                        );

                        return;
                    }

                    /*
                     * Don't delete the auth folder
                     * during a temporary connection
                     * failure.
                     */
                    console.log(
                        "⚠️ Temporary connection failure."
                    );
                }
            }
        );

    } catch (error) {
        console.error(
            "❌ Pairing startup error:",
            error
        );

        removeFile(
            sessionDir
        );

        if (!res.headersSent) {
            res.status(503).send({
                error:
                    "Service Unavailable"
            });
        }
    }
});

module.exports = router;
