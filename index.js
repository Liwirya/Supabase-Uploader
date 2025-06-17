const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const port = 5000;

// Konfigurasi Supabase
const SUPABASE_URL = 'https://ycxcrxdnzcyczbktfzes.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljeGNyeGRuemN5Y3pia3RmemVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxNDU2NzAsImV4cCI6MjA2NTcyMTY3MH0.vwPxPM8hkSCCxLcJRGyiXJ7qzVmkgkzzdHK0mvk5sCg';
const BUCKET_NAME = 'senka';

// Inisialisasi client Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Layani file statis (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint untuk menampilkan file dari Supabase Storage
app.get('/:fileName', async (req, res) => {
    const fileName = req.params.fileName;

    try {
        // Ambil file dari Supabase Storage
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .download(fileName);

        if (error) {
            console.error('Gagal mengambil file dari Supabase:', error);
            return res.status(404).json({ error: 'File tidak ditemukan atau tidak dapat diakses' });
        }

        // Konversi data file (Blob) ke Buffer
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Tentukan Content-Type berdasarkan ekstensi file
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'pdf': 'application/pdf',
            'mp4': 'video/mp4',
            'mov': 'video/quicktime',
            'mp3': 'audio/mpeg',
            'txt': 'text/plain',
            'html': 'text/html',
            'css': 'text/css',
            'js': 'application/javascript'
        };
        const fileExt = fileName.split('.').pop()?.toLowerCase();
        const contentType = mimeTypes[fileExt] || 'application/octet-stream';

        // Set header untuk menampilkan file di browser
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', buffer.length);
        // Tidak menggunakan Content-Disposition agar file ditampilkan di browser

        // Kirim file ke browser
        res.send(buffer);
    } catch (err) {
        console.error('Kesalahan server:', err);
        res.status(500).json({ error: 'Kesalahan server internal' });
    }
});

// Jalankan server
app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});