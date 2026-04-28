import express from "express"
import passport from "passport"
import SteamStrategy from "passport-steam"
import Logic, {
    assertRequiredEnvVar,
    clearAuthCookie,
    createAuthToken,
    ensureAuthenticated,
    getAuthUserFromRequest,
    parsePositiveInt,
    sendJson,
    setAuthCookie
} from "../logic/logic.js"
import cors from "cors"

const DEFAULT_PORT = 3000
const MAX_GAME_LIMIT = 500
const PORT = Number.parseInt(process.env.PORT || `${DEFAULT_PORT}`, 10)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:4200"
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || `http://localhost:${PORT}`
const FRONTEND_LANDING_PATH = process.env.FRONTEND_LANDING_PATH || "/landing"
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "wdps_auth"
const AUTH_TOKEN_TTL_MS = Number.parseInt(process.env.AUTH_TOKEN_TTL_MS || `${1000 * 60 * 60 * 24 * 7}`, 10)
const AUTH_COOKIE_SECURE = process.env.NODE_ENV === "production"
const AUTH_COOKIE_SAMESITE = process.env.AUTH_COOKIE_SAMESITE || "lax"

assertRequiredEnvVar("STEAM_TOKEN")
assertRequiredEnvVar("STEAM_SECRET")

const authConfig = {
    authCookieName: AUTH_COOKIE_NAME,
    authCookieSecure: AUTH_COOKIE_SECURE,
    authCookieSameSite: AUTH_COOKIE_SAMESITE,
    authTokenTtlMs: AUTH_TOKEN_TTL_MS,
    authSigningSecret: process.env.AUTH_SIGNING_SECRET || process.env.STEAM_SECRET
}
const logic = new Logic()

passport.use(
    new SteamStrategy(
        {
            returnURL: `${BACKEND_BASE_URL}/auth/steam/return`,
            realm: `${BACKEND_BASE_URL}/`,
            apiKey: process.env.STEAM_TOKEN
        },
        (identifier, profile, done) => {
            process.nextTick(() => {
                profile.identifier = identifier
                return done(null, profile)
            })
        }
    )
)

const app = express()

app.set("trust proxy", 1)
app.use(passport.initialize())

const allowedOrigins = (process.env.CORS_ORIGINS || FRONTEND_ORIGIN)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)

app.use(
    cors({
        origin(origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true)
            }

            return callback(new Error(`CORS not allowed from origin: ${origin}`))
        },
        credentials: true
    })
)

app.use((req, res, next) => {
    req.authUser = getAuthUserFromRequest(req, authConfig)
    next()
})

app.get("/", (req, res) => {
    res.json({ user: req.authUser || null })
})

app.get("/account", ensureAuthenticated, (req, res) => {
    res.json({ user: req.authUser })
})

app.get("/getUserOwnedGames", ensureAuthenticated, async (req, res) => {
    const getFreeGames = req.query.getFreeGames === "true"
    const limitResult = parsePositiveInt(req.query.limit, "limit", MAX_GAME_LIMIT)

    if (limitResult.error) {
        return sendJson(res, { status: 400, code: 400, message: limitResult.error })
    }

    const returnVal = await logic.getUserOwnedGames(getFreeGames, req.authUser.steamId, limitResult.value)
    if (returnVal?.data?.response) {
        return sendJson(res, returnVal, returnVal.data.response)
    }

    return sendJson(res, returnVal)
})

app.get("/getGameStoreStatsByID", ensureAuthenticated, async (req, res) => {
    const idResult = parsePositiveInt(req.query.id, "id")

    if (!idResult.hasValue || idResult.error) {
        return sendJson(res, {
            status: 400,
            code: 400,
            message: idResult.error || "Game ID is required"
        })
    }

    const returnVal = await logic.getGameStoreStats(idResult.value)
    if (returnVal?.data) {
        return sendJson(res, returnVal, returnVal.data)
    }

    return sendJson(res, returnVal)
})

app.get("/rankUserGames", ensureAuthenticated, async (req, res) => {
    const limitResult = parsePositiveInt(req.query.limit, "limit", MAX_GAME_LIMIT)

    if (limitResult.error) {
        return sendJson(res, { status: 400, code: 400, message: limitResult.error })
    }

    const returnVal = await logic.rankUserGames(req.authUser.steamId, limitResult.value)
    if (returnVal?.data?.response) {
        return sendJson(res, returnVal, returnVal.data.response)
    }

    return sendJson(res, returnVal)
})

app.get("/logout", (_req, res) => {
    clearAuthCookie(res, authConfig)
    res.redirect("/")
})

app.get("/auth/steam", passport.authenticate("steam", { failureRedirect: FRONTEND_ORIGIN, session: false }))

app.get(
    "/auth/steam/return",
    passport.authenticate("steam", { failureRedirect: FRONTEND_ORIGIN, session: false }),
    (req, res) => {
        if (!req.user?.id || !req.user?.displayName) {
            return res.redirect(FRONTEND_ORIGIN)
        }

        const authToken = createAuthToken({
            steamId: req.user.id,
            displayName: req.user.displayName,
            avatar: req.user.photos?.[0]?.value || ""
        }, authConfig)
        setAuthCookie(res, authToken, authConfig)

        const callbackUrl = `${FRONTEND_ORIGIN.replace(/\/$/, "")}${
            FRONTEND_LANDING_PATH.startsWith("/") ? FRONTEND_LANDING_PATH : `/${FRONTEND_LANDING_PATH}`
        }`

        return res.redirect(callbackUrl)
    }
)

const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server listening on port ${PORT}`)
})

server.on("error", (error) => {
    console.error(error.message)
})
