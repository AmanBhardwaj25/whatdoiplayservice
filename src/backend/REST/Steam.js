import express from "express"
import passport from 'passport'
import session from "express-session"
import SteamStrategy from "passport-steam"
import Logic from "../logic/logic.js"
import cors from "cors"

const PORT= process.env.PORT

const logic = new Logic()

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Steam profile is serialized
//   and deserialized.
passport.serializeUser(function(user, done) {
    done(null, user)
})

passport.deserializeUser(function(obj, done) {
    done(null, obj)
})

// Use the SteamStrategy within Passport.
//   Strategies in passport require a `validate` function, which accept
//   credentials (in this case, an OpenID identifier and profile), and invoke a
//   callback with a user object.
passport.use(new SteamStrategy({
        returnURL: `http://localhost:${PORT}/auth/steam/return`,
        realm: `http://localhost:${PORT}/`,
        apiKey: process.env.STEAM_TOKEN
    },
    function(identifier, profile, done) {
        // asynchronous verification, for effect...
        process.nextTick(function () {

            // To keep the example simple, the user's Steam profile is returned to
            // represent the logged-in user.  In a typical application, you would want
            // to associate the Steam account with a user record in your database,
            // and return that user instead.
            profile.identifier = identifier
            return done(null, profile)
        })
    }
))

const app = express()

// configure Express
app.set('view engine', 'ejs')

app.use(session({
    secret: process.env.STEAM_SECRET,
    name: 'SteamSecret',
    resave: true,
    saveUninitialized: true}))

// Initialize Passport!  Also use passport.session() middleware, to support
// persistent login sessions (recommended).
app.use(passport.initialize())
app.use(passport.session())

app.use(cors({
    origin: 'http://localhost:4200', // Allow requests from Angular app
    credentials: true // Allow cookies and session data
}))

app.get('/', function(req, res){
    res.json({ user: req.user })
})

app.get('/account', ensureAuthenticated, function(req, res){
    res.json({ user: req.user })
})

app.get('/getUserOwnedGames', ensureAuthenticated, async function(req, res){
    let getFreeGames = false
    if (Object.prototype.hasOwnProperty.call(req.query, 'getFreeGames') && req.query.getFreeGames === 'true') {
        getFreeGames = true
    }
    let steamId
    if (Object.prototype.hasOwnProperty.call(req, 'user')
        && Object.prototype.hasOwnProperty.call(req.user, '_json')
    && Object.prototype.hasOwnProperty.call(req.user._json, 'steamid')) {
        steamId = req.user._json.steamid
        const returnVal = await logic.getUserOwnedGames(getFreeGames, steamId)
        res.status(returnVal.status)
        res.json({
            code: returnVal.status,
            status: 'success',
            data: returnVal.data.response})
    } else {
        res.status = 400
        res.json({
            code: 400,
            status: "error",
            message: "SteamID was not found in request object"})
    }
})

app.get('/getGameStoreStatsByID', ensureAuthenticated, async function(req, res){
    let titleID
    if (Object.prototype.hasOwnProperty.call(req.query, 'id') && !isNaN(req.query.id)) {
        titleID = parseInt(req.query.id)
        const returnVal = await logic.getGameStoreStats(titleID)
        res.status(returnVal.status)
        res.json({
            code: returnVal.status,
            status: 'success',
            data: returnVal.data})
    } else {
        res.status = 400
        res.json({
            code: 400,
            status: "error",
            message: "Game ID must be provided and should be int format"
        })
    }
})

app.get('/rankUserGames', ensureAuthenticated, async function(req, res){

    let returnVal
    if (Object.prototype.hasOwnProperty.call(req, 'user')
        && Object.prototype.hasOwnProperty.call(req.user, '_json')
        && Object.prototype.hasOwnProperty.call(req.user._json, 'steamid')) {
        returnVal = await logic.rankUserGames(req.user._json.steamid)
        res.status(returnVal.status)
        res.json({
            code: returnVal.status,
            status: 'success',
            data: returnVal.data.response})
    } else {
        res.status = 400
        res.json({
            code: 400,
            status: "error",
            message: "SteamID was not found in request object"})
    }
})

app.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err) // Pass the error to the error handler
        }
        res.redirect('/') // Redirect after successful logout
    })
})


// GET /auth/steam
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Steam authentication will involve redirecting
//   the user to steamcommunity.com.  After authenticating, Steam will redirect the
//   user back to this application at /auth/steam/return
app.get('/auth/steam',
    passport.authenticate('steam', { successRedirect: 'http://localhost:4200', failureRedirect: '/' }),
    function(req, res) {
        res.redirect('/')
    })

// GET /auth/steam/return
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/steam/return',
    passport.authenticate('steam', { failureRedirect: '/' }),
    (req, res) => {
        // Retrieve user details
        const user = req.user;
        const callbackUrl = `http://localhost:4200/landing`;

        // Append user details as query parameters
        const queryParams = new URLSearchParams({
            steamId: user.id,
            displayName: user.displayName,
            avatar: user.photos[0].value // Assuming Steam profile has an avatar URL
        });

        // Redirect to Angular app with user details
        res.redirect(`${callbackUrl}?${queryParams.toString()}`);
    }
);


try {
    app.listen(5005, '0.0.0.0', () => {
        console.log(`Express server listening on port ${PORT}`)
    })
} catch (error) {
    console.error(error.message)
}

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) { return next() }
    res.redirect('/')
}