import axios from "axios";

export default class REST {
    constructor(retries = 5) {
        this.retries = retries
        this.ERROR500 = {
            status: "error",
            code: 500,
            message: "a 500 error was encountered"
        }
        this.ERROR404 = {
            status: "error",
            code: 404,
            message: "a 404 error was encountered"
        }
        this.ERROR400 = {
            status: "error",
            code: 400,
            message: "a 400 error was encountered"
        }
        this.ERROR401 = {
            status: "error",
            code: 401,
            message: "a 401 error was encountered"
        }
        this.SUCCESS200 = {
            status: "success",
            code: 200,
            message: "Endpoint returned 200/Success"
        }
    }

    errorHandler(axiosResponse) {
        const returnObject = {}
        if (axiosResponse.status === 400) {
            Object.assign(returnObject, this.ERROR400)
        } else if (axiosResponse.status === 401) {
            Object.assign(returnObject, this.ERROR401)
        } else if (axiosResponse.status === 404) {
            Object.assign(returnObject, this.ERROR404)
        } else {
            Object.assign(returnObject, this.ERROR500)
        }
        if (axiosResponse.message) returnObject.message = axiosResponse.message
        return returnObject
    }

    async get(url, headers = {}, params = {}, retry = 1) {
        try {
            const config = {
                headers,
                params
            }
            return await axios.get(url, config)
        } catch (error) {
            if (retry <= this.retries) {
                retry++
                return await this.get(url, headers, params, retry)
            } else {
                return this.errorHandler(error)
            }
        }
    }

    async post (url, body = {}, headers = {}, queryParams = {}, retry = 1) {
        try {
            const config = {
                headers,
                queryParams
            }
            return await axios.post(url, body, config)
        } catch (error) {
            if (retry <= this.retries) {
                retry++
                return await this.get(url, headers, queryParams, retry)
            } else {
                return this.errorHandler(error)
            }
        }
    }
}