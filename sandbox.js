const mergeThumbnail = require("./index")

const output = "withThumb.mp4";
let thumbnail = 'Bulaava.jpg'
const input = 'golden.mp4'
let started = Date.now()
mergeThumbnail(
  { output: "C:\\Users\\Utkarsh\\Desktop", workpath: "C:\\Users\\Utkarsh\\Desktop" }, { logger: { log: console.log }, workpath: "C:\\Users\\Utkarsh\\Desktop" }, {
  input, thumbnail, output, thumbnailDuration: 2,
  onStart: () => {
    console.log("Started")
    started = Date.now()
  },
  onComplete: () => console.log("completed in", (Date.now() - started) / 1000, " secs")
})
