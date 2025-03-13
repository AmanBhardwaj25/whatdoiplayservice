import REST from "./src/backend/utils/REST.js";

const rest = new REST()

const test = await rest.get('http://localhost:3030/get200', {
    'Content-Type': 'application/json'
}, {
    x: 'test'
})

console.log(JSON.stringify(test.data, null, 2))

