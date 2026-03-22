const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// 目标目录（相对于server.js的路径）
const SONGS_DIR = path.join(__dirname, 'Songs');

// 静态文件托管（访问index.html）
app.use(express.static(__dirname));

// 解析JSON请求体
app.use(express.json());

// 递归读取目录（最多两层）
async function readDirRecursive(dir, depth = 0, maxDepth = 2) {
    const results = [];
    if (depth > maxDepth) return results;

    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(SONGS_DIR, fullPath);

            if (entry.isFile()) {
                // 仅添加文件（文件夹不提供下载）
                results.push({
                    name: entry.name,
                    path: relativePath,
                    depth: depth
                });
            } else if (entry.isDirectory() && depth < maxDepth) {
                // 递归读取子文件夹
                const subDirResults = await readDirRecursive(fullPath, depth + 1, maxDepth);
                // 为子文件夹文件补充文件夹名称
                subDirResults.forEach(item => {
                    item.folder = relativePath;
                });
                results.push(...subDirResults);
            }
        }
    } catch (err) {
        console.error('读取目录失败：', err);
    }

    return results;
}

// 接口1：获取Songs目录下的文件列表
app.get('/api/files', async (req, res) => {
    try {
        // 检查Songs目录是否存在
        if (!fsSync.existsSync(SONGS_DIR)) {
            await fs.mkdir(SONGS_DIR); // 不存在则创建
            return res.json([]);
        }

        const files = await readDirRecursive(SONGS_DIR);
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: '获取文件列表失败' });
    }
});

// 接口2：下载文件
app.get('/api/download', async (req, res) => {
    try {
        const filePath = decodeURIComponent(req.query.path);
        const fullPath = path.join(SONGS_DIR, filePath);

        // 安全校验：确保下载的文件在Songs目录内
        if (!fullPath.startsWith(SONGS_DIR)) {
            return res.status(403).send('禁止访问：文件不在Songs目录内');
        }

        // 检查文件是否存在且是文件（不是文件夹）
        const stat = await fs.stat(fullPath);
        if (!stat.isFile()) {
            return res.status(400).send('仅支持下载文件，不支持下载文件夹');
        }

        // 设置下载响应头
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(path.basename(fullPath))}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        
        // 流式传输文件
        const fileStream = fsSync.createReadStream(fullPath);
        fileStream.pipe(res);

        // 处理流错误
        fileStream.on('error', (err) => {
            res.status(500).send('文件下载失败');
        });
    } catch (error) {
        console.error('下载文件失败：', error);
        res.status(500).send('下载文件失败');
    }
});

// 启动服务
app.listen(PORT, () => {
    console.log(`文件管理器服务已启动：http://localhost:${PORT}`);
    console.log(`Songs目录路径：${SONGS_DIR}`);
});