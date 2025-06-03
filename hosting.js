const express = require("express");
const path = require("path");
const throttle = require('express-throttle-bandwidth');
const app = express();
const PORT = process.env.PORT || 18658;
const fs = require("fs");

// 设置下载速度限制（单位：Mbps）
const SPEED_LIMIT = 30; // 30Mbps，你可以修改这个数值
const BYTES_PER_SECOND = (SPEED_LIMIT * 1024 * 1024) / 8; // 转换为字节/秒

// 文件名编码函数
function encodeFileName(fileName) {
  // 使用 encodeURIComponent 编码文件名
  return encodeURIComponent(fileName)
    .replace(/['()]/g, escape) // 额外编码 ' ( )
    .replace(/\*/g, '%2A')
    .replace(/%20/g, ' '); // 保留空格的可读性
}

// 设置静态文件目录并添加限速
app.use("/files", 
  throttle(BYTES_PER_SECOND),
  express.static(path.join(__dirname, "files"), {
    setHeaders: (res, filePath) => {
      res.setHeader('Content-Type', 'application/octet-stream');
      const fileName = path.basename(filePath);
      // 使用编码后的文件名
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeFileName(fileName)}`);
    }
  })
);

// 递归获取目录结构的函数
async function getDirectoryStructure(dirPath) {
  const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
  const result = [];
  
  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    const relativePath = path.relative(path.join(__dirname, 'files'), fullPath);
    
    if (item.isDirectory()) {
      const children = await getDirectoryStructure(fullPath);
      result.push({
        name: item.name,
        path: relativePath,
        isDirectory: true,
        children
      });
    } else {
      result.push({
        name: item.name,
        path: relativePath,
        isDirectory: false
      });
    }
  }
  
  return result;
}

// 修改 /files 路由处理
app.get("/files/*", async (req, res) => {
  try {
    const requestPath = req.path.replace('/files', '') || '/';
    const fullPath = path.join(__dirname, 'files', requestPath);
    
    // 安全检查：确保请求路径在 files 目录下
    if (!fullPath.startsWith(path.join(__dirname, 'files'))) {
      return res.status(403).send('Access denied');
    }

    const stat = await fs.promises.stat(fullPath);
    
    if (stat.isDirectory()) {
      const structure = await getDirectoryStructure(fullPath);
      
      // 生成面包屑导航
      const pathParts = requestPath.split('/').filter(Boolean);
      let breadcrumbs = '<a href="/files">根目录</a>';
      let currentPath = '';
      
      for (const part of pathParts) {
        currentPath += '/' + part;
        breadcrumbs += ` > <a href="/files${currentPath}">${part}</a>`;
      }

      // 生成目录和文件列表
      function generateList(items) {
        return items.map(item => {
          if (item.isDirectory) {
            return `<li>📁 <a href="/files/${item.path}">${item.name}/</a></li>`;
          } else {
            return `<li>📄 <a href="/files/${item.path}">${item.name}</a></li>`;
          }
        }).join('\n');
      }

      res.setHeader("Content-Type", "text/html; charset=utf-8");
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
            <div class="download-speed">当前下载速度限制: ${SPEED_LIMIT}Mbps</div>
            <h2>当前目录: ${requestPath || '/'}</h2>
            <ul>
              ${generateList(structure)}
            </ul>
          </body>
        </html>
      `);
    } else {
      // 如果是文件，让静态文件中间件处理
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
        <p>当前下载速度限制: ${SPEED_LIMIT}Mbps</p>
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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Download speed limit: ${SPEED_LIMIT}Mbps`);
});
