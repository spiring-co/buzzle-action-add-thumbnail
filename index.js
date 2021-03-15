const ffmpeg = require("fluent-ffmpeg");
const pkg = require("./package.json");
const fetch = require("node-fetch");
const nfp = require("node-fetch-progress");
const fs = require("fs");
const path = require("path");
const ffprobe = require('ffprobe');
const ffprobeStatic = require('ffprobe-static');
const sharp = require('sharp');
const { Readable } = require('stream')

const getBinary = (job, settings) => {
  return new Promise((resolve, reject) => {
    const version = "b4.2.2";
    const filename = `ffmpeg-${version}${process.platform == "win32" ? ".exe" : ""
      }`;
    const fileurl = `https://github.com/eugeneware/ffmpeg-static/releases/download/${version}/${process.platform}-x64`;
    const output = path.join(settings.workpath, filename);

    if (fs.existsSync(output)) {
      settings.logger.log(
        `> using an existing ffmpeg binary ${version} at: ${output}`
      );
      return resolve(output);
    }

    settings.logger.log(`> ffmpeg binary ${version} is not found`);
    settings.logger.log(
      `> downloading a new ffmpeg binary ${version} to: ${output}`
    );

    const errorHandler = (error) =>
      reject(
        new Error({
          reason: "Unable to download file",
          meta: { fileurl, error },
        })
      );

    fetch(fileurl)
      .then((res) =>
        res.ok
          ? res
          : Promise.reject({
            reason: "Initial error downloading file",
            meta: { fileurl, error: res.error },
          })
      )
      .then((res) => {
        const progress = new nfp(res);

        progress.on("progress", (p) => {
          process.stdout.write(
            `${Math.floor(p.progress * 100)}% - ${p.doneh}/${p.totalh} - ${p.rateh
            } - ${p.etah}                       \r`
          );
        });

        const stream = fs.createWriteStream(output);

        res.body.on("error", errorHandler).pipe(stream);

        stream.on("error", errorHandler).on("finish", () => {
          settings.logger.log(
            `> ffmpeg binary ${version} was successfully downloaded`
          );
          fs.chmodSync(output, 0o755);
          resolve(output);
        });
      });
  });
};
const getBufferFromImageUrl = async (url) => {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer, "utf-8");
  return buffer;
};

module.exports = (job, settings, { input, thumbnail, output, thumbnailDuration = 1, onStart, onComplete }) => {
  onStart()
  return new Promise((resolve, reject) => {
    input = input || job.output;
    output = output || "output.mp4";

    if (input.indexOf("http") !== 0 && !path.isAbsolute(input)) {
      input = path.join(job.workpath, input);
    }
    if (thumbnail.indexOf("http") !== 0 && !path.isAbsolute(thumbnail)) {
      thumbnail = path.join(job.workpath, thumbnail);
    }
    if (!path.isAbsolute(output)) output = path.join(job.workpath, output);

    settings.logger.log(
      `[${job.uid}] starting buzzle-action-add-thumbnail on [${input}] `
    );
    getBinary(job, settings).then(async (p) => {
      ffmpeg.setFfmpegPath(p);
      const videoDetails = (await ffprobe(input, { path: ffprobeStatic.path })).streams.find(({ codec_type }) => codec_type === 'video')
      const imageDetails = (await ffprobe(thumbnail, { path: ffprobeStatic.path })).streams.find((({ codec_type }) => codec_type === 'video'))
      if (videoDetails.width === imageDetails.width && videoDetails.height === imageDetails.height) {
        // run ffmpeg directly
        ffmpeg()
          .input(thumbnail)
          .inputOptions([`-t ${thumbnailDuration}`])
          .input(input)
          .inputOptions(['-vcodec h264', '-acodec mp3'])
          .complexFilter('[0:0] [1:0] concat=n=2:v=1:a=0')
          .on("error", function (err, stdout, stderr) {
            console.log("join thumbnail video failed: " + err.message);
            onComplete()
            reject(err);
          })
          .on("progress", function (value) {
            console.log("In Progress..");
          })
          .on("end", function () {
            onComplete()
            job.output = output;
            resolve(job);
          })
          .save(output);
      }
      else {
        // process image
        settings.logger.log(
          `[${job.uid}] resizing thumbnail for merge on [${thumbnail}] `
        );
        thumbnail = await sharp(thumbnail.startsWith('http') ? await getBufferFromImageUrl(thumbnail) : thumbnail)
          .resize(videoDetails.width, videoDetails.height, { background: '#000', fit: 'contain' })
          .toBuffer()
        settings.logger.log(
          `[${job.uid}] resizing thumbnail finished on [${input}] `
        );
        ffmpeg()
          .input(Readable.from(thumbnail))
          .inputOptions([`-t ${thumbnailDuration}`])
          .input(input)
          .inputOptions(['-vcodec h264', '-acodec mp3'])
          .complexFilter('concat=n=2:v=1:a=0')
          .on("error", function (err, stdout, stderr) {
            settings.logger.log("joining thumbnail with video failed: " + err.message);
            onComplete()
            reject(err);
          })
          .on("progress", function (value) {
            settings.logger.log("In Progress..");
          })
          .on("end", function () {
            onComplete()
            job.output = output;
            resolve(job);
          })
          .save(output);


      }
    }).catch(err => {
      settings.logger.log(err.message)
      onComplete()
      reject(err);
    })
  });
};
