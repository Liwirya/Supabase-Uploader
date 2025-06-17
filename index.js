const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const NodeCache = require('node-cache');

const app = express();
const port = 5000;

// Konfigurasi Supabase
const SUPABASE_URL = 'https://ycxcrxdnzcyczbktfzes.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljeGNyeGRuemN5Y3pia3RmemVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxNDU2NzAsImV4cCI6MjA2NTcyMTY3MH0.vwPxPM8hkSCCxLcJRGyiXJ7qzVmkgkzzdHK0mvk5sCg';
const BUCKET_NAME = 'senka';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Inisialisasi cache (TTL: 1 jam, maksimal 100 file)
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600, maxKeys: 100 });

// Jenis file yang diizinkan
const allowedMimeTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/svg+xml',
    'video/mp4', 'video/quicktime', 'video/x-msvideo',
    'audio/mpeg', 'audio/wav',
    'application/pdf', 'text/plain', 'text/html', 'text/css', 'application/javascript'
];

// Middleware untuk header keamanan
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/:senka', async (req, res) => {
    const senka = req.params.senka;
    console.log(`Mengakses file: ${senka}`);

    // Cek cache
    const cachedFile = cache.get(senka);
    if (cachedFile) {
        const { buffer, contentType, fileSize } = cachedFile;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = (end - start) + 1;

            if (start >= fileSize || end >= fileSize) {
                console.warn(`Range tidak valid untuk ${senka}: ${range}`);
                return res.status(416).send('Requested range not satisfiable');
            }

            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Content-Length', chunkSize);
            res.setHeader('Content-Type', contentType);
            res.end(buffer.slice(start, end + 1));
            return;
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', fileSize);
        res.setHeader('Accept-Ranges', 'bytes');
        res.end(buffer);
        return;
    }

    try {
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .download(senka);

        if (error) {
            console.error('Gagal mengambil file dari Supabase:', error);
            return res.status(404).json({ error: 'File tidak ditemukan atau tidak dapat diakses' });
        }

        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileSize = buffer.length;

        const fileExt = senka.split('.').pop()?.toLowerCase();
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'pdf': 'application/pdf',
            'mp4': 'video/mp4',
            'mov': 'video/quicktime',
            'avi': 'video/x-msvideo',
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'txt': 'text/plain',
            'html': 'text/html',
            'css': 'text/css',
            'js': 'application/javascript'
        };
        const contentType = mimeTypes[fileExt] || 'application/octet-stream';

        if (!allowedMimeTypes.includes(contentType)) {
            console.warn(`Jenis file tidak diizinkan untuk ${senka}: ${contentType}`);
            return res.status(403).json({ error: 'Jenis file tidak diizinkan' });
        }

        cache.set(senka, { buffer, contentType, fileSize });

        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = (end - start) + 1;

            if (start >= fileSize || end >= fileSize) {
                console.warn(`Range tidak valid untuk ${senka}: ${range}`);
                return res.status(416).send('Requested range not satisfiable');
            }

            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Content-Length', chunkSize);
            res.setHeader('Content-Type', contentType);
            res.end(buffer.slice(start, end + 1));
        } else {
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', fileSize);
            res.setHeader('Accept-Ranges', 'bytes');
            res.end(buffer);
        }
    } catch (err) {
        console.error('Kesalahan server:', err);
        res.status(500).json({ error: 'Kesalahan server internal', details: err.message });
    }
});

app.delete('/delete/:senka', async (req, res) => {
    const senka = req.params.senka;
    try {
        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([senka]);

        if (error) {
            console.error('Gagal menghapus file dari Supabase:', error);
            return res.status(400).json({ error: 'Gagal menghapus file' });
        }

        cache.del(senka);
        console.log(`File dihapus: ${senka}`);
        res.json({ message: 'File berhasil dihapus' });
    } catch (err) {
        console.error('Kesalahan server saat menghapus:', err);
        res.status(500).json({ error: 'Kesalahan server internal' });
    }
});

app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});