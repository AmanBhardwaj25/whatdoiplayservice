const apiBaseURL = 'api.steampowered.com'
const storeBaseURL = 'store.steampowered.com'
export const SteamEndpoints = {
    GetOwnedGames: `https://${apiBaseURL}/IPlayerService/GetOwnedGames/v1/`,
    appreviews: `https://${storeBaseURL}/appreviews/`
}