import express from "express";

function main() {
    let app = express();
    app.listen(23456, () => {
        console.log("Dat.ee backend is up and running at http://127.0.0.1:23456")
    });
}

main()