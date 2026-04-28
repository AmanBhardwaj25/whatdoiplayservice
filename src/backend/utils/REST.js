import axios from "axios"

const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.HTTP_TIMEOUT_MS || "8000", 10)
const DEFAULT_RETRY_BASE_DELAY_MS = Number.parseInt(process.env.RETRY_BASE_DELAY_MS || "250", 10)

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

export default class REST {
    constructor(retries = 5) {
        this.retries = retries
    }

    errorHandler(error) {
        const returnObject = {
            status: 500,
            code: 500,
            message: "An error was encountered while calling the Steam API"
        }

        const response = error?.response
        if (response) {
            returnObject.status = response.status
            returnObject.code = response.status
            returnObject.data = response.data

            if (response.status === 400) {
                returnObject.message = response.data?.message || "a 400 error was encountered"
            } else if (response.status === 401) {
                returnObject.message = response.data?.message || "a 401 error was encountered"
            } else if (response.status === 404) {
                returnObject.message = response.data?.message || "a 404 error was encountered"
            } else {
                returnObject.message = response.data?.message || "a 500 error was encountered"
            }
        } else if (error?.message) {
            returnObject.message = error.message
        }

        return returnObject
    }

    isRetryableError(error) {
        if (!error?.response) {
            return true
        }

        const status = error.response.status
        return status === 429 || status >= 500
    }

    backoffDelayMs(attempt) {
        const exponentialDelay = DEFAULT_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)
        const jitter = Math.floor(Math.random() * 100)
        return exponentialDelay + jitter
    }

    async request(method, url, body = undefined, headers = {}, params = {}) {
        let attempt = 1

        while (attempt <= this.retries + 1) {
            try {
                const config = {
                    headers,
                    params,
                    timeout: DEFAULT_TIMEOUT_MS
                }

                if (method === "get") {
                    return await axios.get(url, config)
                }

                return await axios.post(url, body, config)
            } catch (error) {
                const canRetry = attempt <= this.retries && this.isRetryableError(error)
                if (!canRetry) {
                    return this.errorHandler(error)
                }

                await sleep(this.backoffDelayMs(attempt))
                attempt += 1
            }
        }

        return {
            status: 500,
            code: 500,
            message: "Request failed after retries"
        }
    }

    async get(url, headers = {}, params = {}) {
        return await this.request("get", url, undefined, headers, params)
    }

    async post(url, body = {}, headers = {}, queryParams = {}) {
        return await this.request("post", url, body, headers, queryParams)
    }
}
