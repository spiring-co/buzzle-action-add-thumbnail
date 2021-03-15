const mergeThumbnail = require("./index")

const output = "output.mp4";
let thumbnail = 'https://www.bhmpics.com/wallpapers/double_rainbow_over_the_beach-960x540.jpg'
const input = 'video.mp4'
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
