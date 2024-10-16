const ytdl = require("ytdl-core");
const axios = require("axios");
const fs = require("fs");
const { DOMParser } = require("xmldom");

async function getSubtitles(videoUrl) {
  try {
    // 获取视频信息
    const info = await ytdl.getInfo(videoUrl);

    // 找到字幕轨道
    const tracks =
      info.player_response.captions?.playerCaptionsTracklistRenderer
        ?.captionTracks;
    if (!tracks || tracks.length === 0) {
      console.log("这个视频没有可用的字幕");
      return;
    }

    // 默认使用第一个可用的字幕轨道
    const track = tracks[0];

    // 下载字幕文件
    const { data } = await axios.get(track.baseUrl);

    if (!data) {
      console.log("无法获取字幕数据");
      return;
    }

    console.log("原始字幕数据的前1000个字符：", data.substring(0, 1000));

    // 将字幕内容解析为 SRT 格式
    const srtContent = parseCaptionsToSRT(data);

    console.log(
      "解析后的SRT内容的前1000个字符：",
      srtContent.substring(0, 1000)
    );

    // 将 SRT 内容写入文件
    const filename = `subtitles_${info.videoDetails.videoId}.srt`;
    fs.writeFileSync(filename, srtContent);

    console.log(`字幕已保存到文件: ${filename}`);
  } catch (error) {
    console.error("获取字幕时出错:", error.message);
    console.error("错误堆栈:", error.stack);
  }
}

function parseCaptionsToSRT(captionsXml) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(captionsXml, "text/xml");
  const textElements = xmlDoc.getElementsByTagName("text");
  let srt = "";
  let subtitleIndex = 1;

  for (let i = 0; i < textElements.length; i++) {
    const text = textElements[i];
    const start = parseFloat(text.getAttribute("start"));
    const dur = parseFloat(text.getAttribute("dur"));
    const content = text.textContent.trim();

    if (content) {
      srt += `${subtitleIndex}\n`;
      srt += `${formatTime(start)} --> ${formatTime(start + dur)}\n`;
      srt += `${decodeHTML(content)}\n\n`;
      subtitleIndex++;
    }
  }

  return srt;
}

function formatTime(seconds) {
  const date = new Date(seconds * 1000);
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  const ms = String(date.getUTCMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss},${ms}`;
}

function decodeHTML(html) {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// 使用示例
const videoUrl = "https://youtu.be/Jd10x8LiuBc?si=8qC37i-cJjA2L9Ch";
getSubtitles(videoUrl);
