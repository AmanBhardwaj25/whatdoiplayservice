import REST from "../utils/REST.js"
import { SteamEndpoints } from "../resources/SteamEndpoints.js"
import crypto from "crypto"

export function assertRequiredEnvVar(name) {
    if (!process.env[name]) {
        throw new Error(`Missing required environment variable: ${name}`)
    }
}

export function sendJson(res, returnVal, data) {
    let statusCode = Number.isInteger(returnVal?.status)
        ? returnVal.status
        : Number.isInteger(returnVal?.code)
          ? returnVal.code
          : 500

    if (statusCode < 100 || statusCode > 599) {
        statusCode = 500
    }

    if (statusCode >= 200 && statusCode < 300) {
        const payload = {
            code: statusCode,
            status: "success"
        }

        if (data !== undefined) {
            payload.data = data
        }

        return res.status(statusCode).json(payload)
    }

    return res.status(statusCode).json({
        code: statusCode,
        status: "error",
        message: returnVal?.message || "Error processing request",
        data: returnVal?.data
    })
}

export function parsePositiveInt(value, fieldName, max) {
    if (value === undefined) {
        return { hasValue: false, value: undefined }
    }

    const parsed = Number.parseInt(value, 10)
    const isValidInteger = /^\d+$/.test(String(value))

    if (!isValidInteger || Number.isNaN(parsed) || parsed <= 0) {
        return {
            hasValue: true,
            error: `${fieldName} must be a positive integer`
        }
    }

    if (Number.isInteger(max) && parsed > max) {
        return {
            hasValue: true,
            error: `${fieldName} must be less than or equal to ${max}`
        }
    }

    return { hasValue: true, value: parsed }
}

function toBase64Url(buffer) {
    return buffer
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "")
}

function fromBase64Url(value) {
    const padded = value + "=".repeat((4 - (value.length % 4)) % 4)
    const base64 = padded.replace(/-/g, "+").replace(/_/g, "/")
    return Buffer.from(base64, "base64")
}

function signTokenPayload(payloadPart, authSigningSecret) {
    return toBase64Url(crypto.createHmac("sha256", authSigningSecret).update(payloadPart).digest())
}

function verifyAuthToken(token, authConfig) {
    if (!token || typeof token !== "string") {
        return null
    }

    const parts = token.split(".")
    if (parts.length !== 2) {
        return null
    }

    const [payloadPart, signaturePart] = parts
    if (!payloadPart || !signaturePart) {
        return null
    }

    const expectedSignaturePart = signTokenPayload(payloadPart, authConfig.authSigningSecret)
    const receivedSignatureBuffer = Buffer.from(signaturePart, "utf8")
    const expectedSignatureBuffer = Buffer.from(expectedSignaturePart, "utf8")

    if (
        receivedSignatureBuffer.length !== expectedSignatureBuffer.length ||
        !crypto.timingSafeEqual(receivedSignatureBuffer, expectedSignatureBuffer)
    ) {
        return null
    }

    try {
        const payloadBuffer = fromBase64Url(payloadPart)
        const payload = JSON.parse(payloadBuffer.toString("utf8"))

        if (!payload?.steamId || !payload?.displayName || !payload?.exp) {
            return null
        }

        if (Date.now() >= payload.exp) {
            return null
        }

        return {
            steamId: payload.steamId,
            displayName: payload.displayName,
            avatar: payload.avatar || ""
        }
    } catch (error) {
        return null
    }
}

function parseCookies(headerValue) {
    const cookies = {}
    if (!headerValue) {
        return cookies
    }

    const parts = headerValue.split(";")
    for (const part of parts) {
        const [rawKey, ...rawValueParts] = part.trim().split("=")
        if (!rawKey) {
            continue
        }

        cookies[rawKey] = decodeURIComponent(rawValueParts.join("=") || "")
    }

    return cookies
}

export function createAuthToken(userPayload, authConfig) {
    const now = Date.now()
    const payload = {
        ...userPayload,
        iat: now,
        exp: now + authConfig.authTokenTtlMs
    }

    const payloadPart = toBase64Url(Buffer.from(JSON.stringify(payload), "utf8"))
    const signaturePart = signTokenPayload(payloadPart, authConfig.authSigningSecret)
    return `${payloadPart}.${signaturePart}`
}

export function getAuthUserFromRequest(req, authConfig) {
    const cookies = parseCookies(req.headers.cookie)
    const authToken = cookies[authConfig.authCookieName]
    return verifyAuthToken(authToken, authConfig)
}

export function setAuthCookie(res, authToken, authConfig) {
    res.cookie(authConfig.authCookieName, authToken, {
        httpOnly: true,
        sameSite: authConfig.authCookieSameSite,
        secure: authConfig.authCookieSecure,
        maxAge: authConfig.authTokenTtlMs,
        path: "/"
    })
}

export function clearAuthCookie(res, authConfig) {
    res.clearCookie(authConfig.authCookieName, {
        httpOnly: true,
        sameSite: authConfig.authCookieSameSite,
        secure: authConfig.authCookieSecure,
        path: "/"
    })
}

export function ensureAuthenticated(req, res, next) {
    if (req.authUser) {
        return next()
    }

    return res.status(401).json({
        code: 401,
        status: "error",
        message: "Authentication required"
    })
}

async function mapWithConcurrency(items, concurrency, worker) {
    const results = new Array(items.length)
    let nextIndex = 0

    const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex
            nextIndex += 1
            results[currentIndex] = await worker(items[currentIndex], currentIndex)
        }
    })

    await Promise.all(runners)
    return results
}

function safeDivide(numerator, denominator) {
    return denominator ? numerator / denominator : 0
}

export default class Logic {
    constructor() {
        this.rest = new REST()
        this.reviewStatsCache = new Map()
        this.reviewStatsCacheTtlMs = Number.parseInt(process.env.REVIEW_CACHE_TTL_MS || "3600000", 10)
        this.reviewRequestConcurrency = Number.parseInt(process.env.REVIEW_CONCURRENCY || "8", 10)
    }

    async getUserOwnedGames(getFreeGames, steamId, limit) {
        const params = {
            input_json: JSON.stringify({
                steamid: steamId,
                include_appinfo: true,
                include_played_free_games: getFreeGames
            }),
            key: process.env.STEAM_TOKEN
        }

        const response = await this.rest.get(SteamEndpoints.GetOwnedGames, {}, params)
        if (response?.data?.response?.games && Number.isInteger(limit) && limit > 0) {
            response.data.response.games = response.data.response.games.slice(0, limit)
            response.data.response.game_count = response.data.response.games.length
        }

        return response
    }

    async getGameStoreStats(titleID) {
        return await this.rest.get(`${SteamEndpoints.appreviews}${titleID}`, {}, { json: 1 })
    }

    getReviewCacheKey(appid) {
        return String(appid)
    }

    getCachedReviewStats(appid) {
        const cacheKey = this.getReviewCacheKey(appid)
        const record = this.reviewStatsCache.get(cacheKey)

        if (!record) {
            return null
        }

        if (Date.now() > record.expiresAt) {
            this.reviewStatsCache.delete(cacheKey)
            return null
        }

        return record.value
    }

    setCachedReviewStats(appid, value) {
        const cacheKey = this.getReviewCacheKey(appid)
        this.reviewStatsCache.set(cacheKey, {
            value,
            expiresAt: Date.now() + this.reviewStatsCacheTtlMs
        })
    }

    async rankUserGames(steamId, limit) {
        const allGames = await this.getUserOwnedGames(true, steamId)

        if (!allGames?.data?.response || typeof allGames.data.response.game_count !== "number") {
            return {
                status: allGames?.status || allGames?.code || 500,
                code: allGames?.code || 500,
                message: allGames?.message || "Error getting game data.",
                data: allGames?.data
            }
        }

        const gameCount = allGames.data.response.game_count
        const games = allGames.data.response.games || []

        if (gameCount === 0) {
            return {
                status: 200,
                code: 200,
                data: { response: { games: [] } }
            }
        }

        if (gameCount === 1) {
            return {
                status: 200,
                code: 200,
                data: { response: { games } }
            }
        }

        const tracker = new Map()
        await mapWithConcurrency(games, this.reviewRequestConcurrency, async (game) => {
            const cachedStats = this.getCachedReviewStats(game.appid)
            if (cachedStats) {
                tracker.set(game.appid, cachedStats)
                return
            }

            const stats = await this.getGameStoreStats(game.appid)
            tracker.set(game.appid, stats)
            this.setCachedReviewStats(game.appid, stats)
        })

        allGames.data.response.games = games.sort((a, b) => {
            const aStats = tracker.get(a.appid)
            const bStats = tracker.get(b.appid)

            const aScore = aStats?.data?.query_summary?.review_score ?? 0
            const bScore = bStats?.data?.query_summary?.review_score ?? 0

            if (aScore === bScore) {
                const aPositiveScore = safeDivide(
                    aStats?.data?.query_summary?.total_positive ?? 0,
                    aStats?.data?.query_summary?.total_reviews ?? 1
                )
                const bPositiveScore = safeDivide(
                    bStats?.data?.query_summary?.total_positive ?? 0,
                    bStats?.data?.query_summary?.total_reviews ?? 1
                )
                return bPositiveScore - aPositiveScore
            }

            return bScore - aScore
        })

        if (Number.isInteger(limit) && limit > 0) {
            allGames.data.response.games = allGames.data.response.games.slice(0, limit)
            allGames.data.response.game_count = allGames.data.response.games.length
        }

        return {
            status: 200,
            code: 200,
            data: allGames.data
        }
    }
}
