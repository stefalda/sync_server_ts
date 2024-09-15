//import fetch from 'node-fetch';
async function testRegistration() {
    const response = await fetch("http://localhost:3000/register/MEMENTO", {
        method: "post",
        headers: {
            "user-agent": "Dart/3.0 (dart:io)",
            "content-type": "application/json; charset=utf-8",
            "accept": "application/json",
            "accept-encoding": "gzip",
            "content-length": "342",
            "host": "memento.babisoft.com",
        },
        body: JSON.stringify({
            "password": "password123",
            "newRegistration": true,
            "clientId": "e64bec40-eb61-4fb8-a2d0-532925c6df1f",
            "email": "stefano@test.com",
            "deleteRemoteData": false,
            "name": "ste",
            "clientDescription": "{\"name\":\"Stefano’s MacBook Pro\",\"systemName\":\"MACOS\",\"systemVersion\":\"Version 13.3.1 (a) (Build 22E772610a)\",\"model\":\"MacBookPro18,1\"}"
        })
    })
    const data = await response.json();

    console.log(data);
}

function main() {
    console.log("Test Registration");
    testRegistration().then(e => console.log(e));

}

main();