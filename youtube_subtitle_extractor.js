const ytdl = require("ytdl-core");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");
const { DOMParser } = require("xmldom");
const crypto = require("crypto");

async function getSubtitles(videoUrl) {
  try {
    // 获取视频信息
    const info = await ytdl.getInfo(videoUrl);

    // 找到字幕轨道
    const tracks =
      info.player_response.captions?.playerCaptionsTracklistRenderer
        ?.captionTracks;
    if (!tracks || tracks.length === 0) {
      throw new Error("这个视频没有可用的字幕");
    }

    // 查找英文字幕轨道
    const englishTrack = tracks.find(track => track.languageCode === 'en');
    if (!englishTrack) {
      throw new Error("这个视频没有可用的英文字幕");
    }

    // 下载英文字幕文件
    const { data } = await axios.get(englishTrack.baseUrl);

    if (!data) {
      throw new Error("无法获取英文字幕数据");
    }

    // 将字幕内容解析为 SRT 格式
    const srtContent = parseCaptionsToSRT(data);

    // 创建临时文件
    const tempDir = os.tmpdir();
    const tempFileName = `subtitles_en_${crypto.randomBytes(16).toString("hex")}.srt`;
    const tempFilePath = path.join(tempDir, tempFileName);

    // 将 SRT 内容写入临时文件
    await fs.writeFile(tempFilePath, srtContent);

    console.log(`英文字幕已保存到临时文件: ${tempFilePath}`);

    return { srtContent, tempFilePath };
  } catch (error) {
    console.error("获取英文字幕时出错:", error.message);
    throw error;
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

module.exports = { getSubtitles };
