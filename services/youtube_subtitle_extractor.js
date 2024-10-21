const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");
const { DOMParser } = require("xmldom");
const crypto = require("crypto");

async function getSubtitles(info) {
  try {
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

    // 将字幕内容解析为新的格式
    const parsedSubtitles = parseCaptionsToArray(data);

    // // 创建临时文件
    // const tempDir = os.tmpdir();
    // const tempFileName = `subtitles_en_${crypto.randomBytes(16).toString("hex")}.json`;
    // const tempFilePath = path.join(tempDir, tempFileName);

    // // 将解析后的字幕内容写入临时文件
    // await fs.writeFile(tempFilePath, JSON.stringify(parsedSubtitles));

    // console.log(`解析后的英文字幕已保存到临时文件: ${tempFilePath}`);

    return { 
      parsedSubtitles, 
      // tempFilePath 
    };
  } catch (error) {
    console.error("获取英文字幕时出错:", error.message);
    return { parsedSubtitles: null };
  }
}

/*
[
  {
    id: "subtitle_1",
    start: 0.485,
    end: 5.297,
    originText: "MR. TRASK: I'm going to recommend to the disciplinary committee"
    translatedText: "" // 初始化为空字符串，后续会填充翻译
  },
  {
    id: "subtitle_2",
    start: 5.297,
    end: 7.878,
    originText: "that you be expelled, Mr. Simms."
    translatedText: ""
  },
  {
    id: "subtitle_3",
    start: 7.878,
    end: 11.666,
    originText: "You are a cover-up artist and you are a liar."
    translatedText: ""
  },
  // ... 
]
*/
function parseCaptionsToArray(captionsXml) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(captionsXml, "text/xml");
  const textElements = xmlDoc.getElementsByTagName("text");
  const subtitles = [];

  for (let i = 0; i < textElements.length; i++) {
    const text = textElements[i];
    const start = parseFloat(text.getAttribute("start"));
    const dur = parseFloat(text.getAttribute("dur"));
    const content = text.textContent.trim();

    if (content) {
      subtitles.push({
        id: `subtitle_${i + 1}`,
        start: start,
        end: start + dur,
        originText: decodeHTML(content),
        translatedText: '' // 初始化为空字符串，后续会填充翻译
      });
    }
  }

  return subtitles;
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
