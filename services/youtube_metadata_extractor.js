const ytdl = require("ytdl-core");

async function extractVideoMetadata(info) {
  const videoTitle = info.videoDetails.title;
  const videoDescription = info.videoDetails.description;
  const videoDuration = parseInt(info.videoDetails.lengthSeconds);

  const format =
    info.formats.find((format) => {
      return (
        format.hasAudio &&
        format.hasVideo &&
        format.container === "mp4" &&
        !format.qualityLabel.includes("2160p") &&
        !format.qualityLabel.includes("1440p")
      );
    }) || ytdl.chooseFormat(info.formats, { quality: "highest" });

  const directVideoUrl = format.url;

  return {
    videoTitle,
    videoDescription,
    directVideoUrl,
    videoDuration,
  };
}

module.exports = { extractVideoMetadata };
