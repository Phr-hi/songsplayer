const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(__dirname)); 

const SONGS_DIR = path.join(__dirname, 'Songs');

async function readDirRecursive(dir, depth = 0, maxDepth = 2) {
    const results = [];
    if (depth > maxDepth) return results;

    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(SONGS_DIR, fullPath);

            if (entry.isFile()) {
                results.push({
                    name: entry.name,
                    path: relativePath,
                    depth: depth
                });
            } else if (entry.isDirectory() && depth < maxDepth) {
                const subDirResults = await readDirRecursive(fullPath, depth + 1, maxDepth);
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

app.get('/api/files', async (req, res) => {
    try {
        if (!fsSync.existsSync(SONGS_DIR)) {
            await fs.mkdir(SONGS_DIR, { recursive: true });
            return res.json([]);
        }

        const files = await readDirRecursive(SONGS_DIR);
        res.json(files);
    } catch (error) {
        console.error('获取文件列表失败：', error);
        res.status(500).json({ error: '获取文件列表失败' });
    }
});

app.get('/api/download', async (req, res) => {
    try {
        const filePath = decodeURIComponent(req.query.path);
        const fullPath = path.join(SONGS_DIR, filePath);

        if (!fullPath.startsWith(SONGS_DIR)) {
            return res.status(403).send('禁止访问：文件不在Songs目录内');
        }

        const stat = await fs.stat(fullPath);
        if (!stat.isFile()) {
            return res.status(400).send('仅支持下载文件，不支持下载文件夹');
        }

        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(path.basename(fullPath))}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        
        const fileStream = fsSync.createReadStream(fullPath);
        fileStream.pipe(res);

        fileStream.on('error', (err) => {
            res.status(500).send('文件下载失败');
        });
    } catch (error) {
        console.error('下载文件失败：', error);
        res.status(500).send('下载文件失败');
    }
});

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`服务已启动：http://localhost:${PORT}`);
    console.log(`Songs目录路径：${SONGS_DIR}`);
});
