const express = require("express");
const path = require("path");
const throttle = require('express-throttle-bandwidth');
const app = express();
const fs = require("fs");

// 读取配置文件
const config = require('./config.json');
const PORT = process.env.PORT || config.port;
const HOST = config.host;

// 设置下载速度限制（单位：Mbps）
const SPEED_LIMIT = config.speedLimit.speed; 
const BYTES_PER_SECOND = config.speedLimit.enable ? (SPEED_LIMIT * 1024 * 1024) / 8 : 0;

// 文件名编码函数
function encodeFileName(fileName) {
  return encodeURIComponent(fileName)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A')
    .replace(/%20/g, ' ');
}

// 设置静态文件目录并添加限速
const staticMiddleware = express.static(path.join(__dirname, "files"), {
  setHeaders: (res, filePath) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    const fileName = path.basename(filePath);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeFileName(fileName)}`);
  }
});

// 根据配置决定是否启用限速
if (config.speedLimit.enable) {
  app.use("/files", throttle(BYTES_PER_SECOND), staticMiddleware);
} else {
  app.use("/files", staticMiddleware);
}

// ...existing code for getDirectoryStructure function...

// 修改 /files 路由处理
app.get("/files/*", async (req, res) => {
  try {
    // ...existing code...
    
    if (stat.isDirectory()) {
      // ...existing code...
      
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Files List - ${requestPath}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .breadcrumbs { margin-bottom: 20px; }
              ul { list-style-type: none; padding-left: 20px; }
              li { margin: 5px 0; }
              .download-speed { position: fixed; top: 10px; right: 10px; }
            </style>
          </head>
          <body>
            <div class="breadcrumbs">${breadcrumbs}</div>
            <div class="download-speed">
              ${config.speedLimit.enable 
                ? `当前下载速度限制: ${SPEED_LIMIT}Mbps` 
                : '未启用速度限制'}
            </div>
            <h2>当前目录: ${requestPath || '/'}</h2>
            <ul>
              ${generateList(structure)}
            </ul>
          </body>
        </html>
      `);
    } else {
      res.status(404).send('File not found');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error reading directory');
  }
});

// 处理根目录的请求
app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>File Hosting</title>
      </head>
      <body>
        <h1>私人文件托管服务</h1>
        <p>${config.speedLimit.enable 
          ? `当前下载速度限制: ${SPEED_LIMIT}Mbps`
          : '未启用速度限制'}</p>
        <p><a href="/files">浏览文件</a></p>
      </body>
    </html>
  `);
});

// 处理 404 错误
app.use((req, res) => {
  res.status(404).send("File not found");
});

// 处理robots.txt
app.get("/robots.txt", (req, res) => {
  res.send("User-agent: *\nDisallow: /files");
});

app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
  if (config.speedLimit.enable) {
    console.log(`Download speed limit: ${SPEED_LIMIT}Mbps`);
  } else {
    console.log('Speed limit is disabled');
  }
});
