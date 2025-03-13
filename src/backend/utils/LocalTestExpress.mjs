import express from 'express'


    const expressApp = express()


    expressApp.get('/get200', (req, res) => {
        res.json({message: 'Successful call'})
    })

    expressApp.get('/get400', (req, res) => {
        res.status(400)
        res.send('400 Error')
    })

    expressApp.get('/get500', (req, res) => {
        res.status(500)
        res.send('500 Error')
    })

    expressApp.get('/get404', (req, res) => {
        res.status(400)
        res.send('404 Error')
    })

    const port = 3030
    expressApp.listen(port,() => {
        console.log(`Express server listening on port ${port}`)
    })

