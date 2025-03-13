import REST from "../utils/REST.js";
import {SteamEndpoints} from "../resources/SteamEndpoints.js";

export default class Logic {
    constructor() {
        this.rest = new REST()
    }

    async getUserOwnedGames(getFreeGames, steamId) {

        const params = {
            input_json: JSON.stringify({
                steamid: steamId,
                include_appinfo: true,
                include_played_free_games: getFreeGames
            }),
            key: process.env.STEAM_TOKEN
        }
        return await this.rest.get(SteamEndpoints.GetOwnedGames, {} ,params)
    }


    async getGameStoreStats(titleID) {
        return await this.rest.get(`${SteamEndpoints.appreviews}${titleID}`, {}, {json: 1})
    }

    async rankUserGames(steamId) {
        let allGames = await this.getUserOwnedGames(true, steamId)

        if (Object.prototype.hasOwnProperty.call(allGames, 'data')
        && Object.prototype.hasOwnProperty.call(allGames.data, 'response')
         && Object.prototype.hasOwnProperty.call(allGames.data.response,'game_count')) {

            if (allGames.data.response.game_count === 0) {
                return []
            }

            if (allGames.data.response.game_count  === 1) {
                return allGames.data.response.games
            }

            const tracker = new Map()

            for (const game of allGames.data.response.games) {
                const stats = await this.getGameStoreStats(game.appid)
                tracker.set(game.appid, stats)
            }

            allGames.data.response.games = allGames.data.response.games.sort((a, b) => {

                const aStats = tracker.get(a.appid)
                const bStats = tracker.get(b.appid)

                if (aStats.data.query_summary.review_score === bStats.data.query_summary.review_score) {
                    const aPositiveScore = aStats.data.query_summary.total_positive / aStats.data.query_summary.total_reviews
                    const bPositiveScore = bStats.data.query_summary.total_positive / bStats.data.query_summary.total_reviews
                    if (aPositiveScore > bPositiveScore) {
                        return -1
                    } else if (aPositiveScore < bPositiveScore) {
                        return 1
                    } else {
                        return 0
                    }
                } else if (aStats.data.query_summary.review_score > bStats.data.query_summary.review_score) {
                    return -1; // a comes before b (higher score goes earlier, descending order)
                } else {
                    return 1; // a comes after b (lower score goes later, descending order)
                }
            })

            return allGames

        } else {
            return {
                code: allGames.code,
                status: "error",
                message: "Error getting game data.",
                data: allGames.data}
        }

    }
}