const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const SONGS_REMOTE_BASE_URL = 'https://songsplayer.infinityfreeapp.com/Songs/';
const LOCAL_SONGS_DIR = path.join(__dirname, 'songs');

app.use(express.static(path.join(__dirname, "build")));
app.use(express.json());

async function getRemoteFileList() {
    try {
        const response = await fetch(`${SONGS_REMOTE_BASE_URL}file-list.json`);
        if (!response.ok) throw new Error('远程服务器响应失败');
        return await response.json();
    } catch (err) {
        console.error('获取远程文件列表失败：', err);
        return [];
    }
}

app.get('/api/files', async (req, res) => {
    try {
        if (!fsSync.existsSync(LOCAL_SONGS_DIR)) {
            await fs.mkdir(LOCAL_SONGS_DIR, { recursive: true });
        }
        const files = await getRemoteFileList();
        res.json(files);
    } catch (error) {
        console.error('接口错误：', error);
        res.status(500).json({ error: '获取文件列表失败', detail: error.message });
    }
});

app.get('/api/download', async (req, res) => {
    try {
        const filePath = decodeURIComponent(req.query.path);
        const remoteFileUrl = `${SONGS_REMOTE_BASE_URL}${filePath}`;

        if (!remoteFileUrl.startsWith(SONGS_REMOTE_BASE_URL)) {
            return res.status(403).send('禁止访问：文件不在合法目录内');
        }

        const response = await fetch(remoteFileUrl);
        if (!response.ok) throw new Error(`远程文件不存在：${response.status}`);

        const fileName = path.basename(filePath);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream');

        const stream = await response.body;
        stream.pipe(res);

    } catch (error) {
        console.error('下载错误：', error);
        res.status(500).json({ error: '下载文件失败', detail: error.message });
    }
});

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "build", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`文件管理器服务已启动：http://localhost:${PORT}`);
    console.log(`远程 Songs 地址：${SONGS_REMOTE_BASE_URL}`);
    console.log(`本地临时目录：${LOCAL_SONGS_DIR}`);
});
