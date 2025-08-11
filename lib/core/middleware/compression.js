/**
 * This file is for the framework veko.js
 * This file is destined for the compression middleware
 */

const zlib = require('zlib');

class Compression {
    constructor(options = {}) {
        this.level = options.level || 6;
        this.threshold = options.threshold || 1024;
        this.filter = options.filter || this.defaultFilter;
        this.chunkSize = options.chunkSize || 16384;
        this.windowBits = options.windowBits || 15;
        this.memLevel = options.memLevel || 8;
        this.strategy = options.strategy || zlib.constants.Z_DEFAULT_STRATEGY;
        this.encodings = ['gzip', 'deflate', 'br'];
    }

    setLevel(level) {
        this.level = Math.max(0, Math.min(9, level));
        return this;
    }

    setThreshold(threshold) {
        this.threshold = Math.max(0, threshold);
        return this;
    }

    setFilter(filterFn) {
        if (typeof filterFn === 'function') {
            this.filter = filterFn;
        }
        return this;
    }

    setChunkSize(size) {
        this.chunkSize = Math.max(1024, size);
        return this;
    }

    getLevel() {
        return this.level;
    }

    getThreshold() {
        return this.threshold;
    }

    getConfig() {
        return {
            level: this.level,
            threshold: this.threshold,
            chunkSize: this.chunkSize,
            windowBits: this.windowBits,
            memLevel: this.memLevel
        };
    }

    defaultFilter(req, res) {
        const contentType = res.getHeader('content-type') || '';
        const compressibleTypes = [
            'text/', 'application/json', 'application/javascript',
            'application/xml', 'application/xhtml+xml', 'image/svg+xml',
            'application/rss+xml', 'application/atom+xml'
        ];
        return compressibleTypes.some(type => contentType.includes(type));
    }

    getBestEncoding(acceptEncoding) {
        if (!acceptEncoding) return null;
        
        const accepted = acceptEncoding.toLowerCase();
        
        if (accepted.includes('br')) return 'br';
        if (accepted.includes('gzip')) return 'gzip';
        if (accepted.includes('deflate')) return 'deflate';
        
        return null;
    }

    shouldCompress(req, res, body) {
        if (!body || typeof body !== 'string') return false;
        if (!this.filter(req, res)) return false;
        if (body.length < this.threshold) return false;
        if (res.getHeader('content-encoding')) return false;
        if (res.getHeader('cache-control')?.includes('no-transform')) return false;
        
        return this.getBestEncoding(req.getHeader('accept-encoding')) !== null;
    }

    getCompressionOptions() {
        return {
            level: this.level,
            chunkSize: this.chunkSize,
            windowBits: this.windowBits,
            memLevel: this.memLevel,
            strategy: this.strategy
        };
    }

    async compressData(data, encoding) {
        return new Promise((resolve, reject) => {
            const options = this.getCompressionOptions();
            let compressor;

            switch (encoding) {
                case 'gzip':
                    compressor = zlib.createGzip(options);
                    break;
                case 'deflate':
                    compressor = zlib.createDeflate(options);
                    break;
                case 'br':
                    compressor = zlib.createBrotliCompress({
                        params: {
                            [zlib.constants.BROTLI_PARAM_QUALITY]: this.level,
                            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length
                        }
                    });
                    break;
                default:
                    return reject(new Error(`Unsupported encoding: ${encoding}`));
            }

            let chunks = [];
            let totalLength = 0;

            compressor.on('data', (chunk) => {
                chunks.push(chunk);
                totalLength += chunk.length;
            });

            compressor.on('end', () => {
                resolve(Buffer.concat(chunks, totalLength));
            });

            compressor.on('error', reject);

            compressor.end(Buffer.from(data));
        });
    }

    middleware() {
        return (req, res, next) => {
            const originalSend = res.send;
            const originalJson = res.json;
            const originalText = res.text;
            const originalHtml = res.html;

            const compressAndSend = async (data, originalMethod) => {
                try {
                    if (!this.shouldCompress(req, res, data)) {
                        return originalMethod.call(res, data);
                    }

                    const encoding = this.getBestEncoding(req.getHeader('accept-encoding'));
                    if (!encoding) {
                        return originalMethod.call(res, data);
                    }

                    const compressed = await this.compressData(data, encoding);
                    
                    res.setHeader('Content-Encoding', encoding);
                    res.setHeader('Content-Length', compressed.length);
                    res.setHeader('Vary', 'Accept-Encoding');
                    
                    if (!res.getHeader('cache-control')) {
                        res.setHeader('Cache-Control', 'public, max-age=31536000');
                    }

                    return originalSend.call(res, compressed);

                } catch (error) {
                    console.error('Compression error:', error.message);
                    return originalMethod.call(res, data);
                }
            };

            res.send = function(data) {
                return compressAndSend(data, originalSend);
            };

            res.json = function(data) {
                const jsonData = JSON.stringify(data);
                res.setHeader('Content-Type', 'application/json');
                return compressAndSend(jsonData, originalSend);
            };

            res.text = function(data) {
                res.setHeader('Content-Type', 'text/plain');
                return compressAndSend(data, originalSend);
            };

            res.html = function(data) {
                res.setHeader('Content-Type', 'text/html');
                return compressAndSend(data, originalSend);
            };

            next();
        };
    }

    enable(req, res, next) {
        this.middleware()(req, res, next);
    }

    static create(options) {
        return new Compression(options);
    }
}

module.exports = Compression;