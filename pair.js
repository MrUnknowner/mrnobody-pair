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
    if (!fs.existsSync(filePath)) return;

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

    let socket;

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
                keys: makeCacheableSignalKeyStore(
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
            browser: Browsers.macOS(
                "Safari"
            )
        });

        socket.ev.on(
            "creds.update",
            saveCreds
        );

        if (!state.creds.registered) {
            await delay(1500);

            const code =
                await socket.requestPairingCode(
                    number
                );

            if (!res.headersSent) {
                res.send({
                    code
                });
            }
        }

        socket.ev.on(
            "connection.update",
            async (update) => {
                const {
                    connection,
                    lastDisconnect
                } = update;

                if (
                    connection === "open"
                ) {
                    try {
                        /*
                         * Give Baileys time to finish
                         * writing the auth state.
                         */
                        await delay(5000);

                        /*
                         * Confirm that the COMPLETE
                         * auth directory exists.
                         */
                        const files =
                            fs.readdirSync(
                                sessionDir
                            );

                        if (
                            !files.length
                        ) {
                            throw new Error(
                                "Session files were not created"
                            );
                        }

                        /*
                         * Generate the public
                         * MrNobody session ID.
                         */
                        const generatedSession =
                            createSessionId();

                        /*
                         * Store the COMPLETE
                         * Baileys auth directory.
                         *
                         * This includes:
                         * - creds.json
                         * - signal keys
                         * - app-state keys
                         * - other auth files
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
                            "Full session state stored:",
                            generatedSession
                        );

                        /*
                         * The temporary directory
                         * is no longer needed.
                         */
                        removeFile(
                            sessionDir
                        );

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
                            "Session generated successfully."
                        );

                    } catch (error) {
                        console.error(
                            "Session generation error:",
                            error
                        );

                        removeFile(
                            sessionDir
                        );
                    }
                }

                if (
                    connection === "close"
                ) {
                    const reason =
                        lastDisconnect
                            ?.error
                            ?.output
                            ?.statusCode;

                    if (
                        reason ===
                        DisconnectReason.loggedOut
                    ) {
                        console.log(
                            "WhatsApp session logged out."
                        );

                        removeFile(
                            sessionDir
                        );
                    } else {
                        console.log(
                            "Connection closed:",
                            reason
                        );
                    }
                }
            }
        );

    } catch (error) {
        console.error(
            "Pairing error:",
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
