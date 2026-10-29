import fs from 'fs';
import zlib from 'zlib';

function createPNG(width, height, isMaskable = false) {
  // RGBA buffer
  const buffer = Buffer.alloc(width * height * 4);
  const cx = width / 2;
  const cy = height / 2;
  const rMax = width / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      // Deep sci-fi black-cyan backdrop
      let r = 2;
      let g = 8;
      let b = 20;
      let a = 255;

      // Glow center
      const centerFactor = Math.max(0, 1 - dist / (rMax * 0.9));
      r += Math.floor(centerFactor * 10);
      g += Math.floor(centerFactor * 40);
      b += Math.floor(centerFactor * 70);

      // Outer rings
      const ring1 = Math.abs(dist - rMax * 0.82) < 2.5;
      const ring2 = Math.abs(dist - rMax * 0.72) < 4;
      const ring3 = Math.abs(dist - rMax * 0.52) < 3;
      const ring4 = Math.abs(dist - rMax * 0.36) < 2;

      // Dashes
      const dash = Math.sin(angle * 12) > 0;
      const dashSmall = Math.sin(angle * 24) > 0.2;

      if (ring1 && dashSmall) {
        r = 6; g = 182; b = 212; // cyan
      } else if (ring2 && dash) {
        r = 56; g = 189; b = 248; // sky blue
      } else if (ring3) {
        r = 14; g = 165; b = 233;
      } else if (ring4) {
        r = 34; g = 211; b = 238;
      }

      // Crosshairs
      if ((Math.abs(dx) < 2 && dist > rMax * 0.3 && dist < rMax * 0.9) ||
          (Math.abs(dy) < 2 && dist > rMax * 0.3 && dist < rMax * 0.9)) {
        r = 34; g = 211; b = 238;
      }

      // Core glow
      if (dist < rMax * 0.25) {
        const coreIntensity = Math.max(0, 1 - dist / (rMax * 0.25));
        r = Math.min(255, Math.floor(180 * coreIntensity + 34));
        g = Math.min(255, Math.floor(230 * coreIntensity + 180));
        b = 255;
      }

      // Inner white eye
      if (dist < rMax * 0.08) {
        r = 255; g = 255; b = 255;
      }

      // Maskable boundary padding if not maskable
      if (!isMaskable && dist > rMax - 2) {
        a = 0;
      }

      buffer[idx] = r;
      buffer[idx + 1] = g;
      buffer[idx + 2] = b;
      buffer[idx + 3] = a;
    }
  }

  // Build PNG chunk
  // Raw image data with filter byte 0 at start of each scanline
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  let srcOffset = 0;
  let dstOffset = 0;
  for (let y = 0; y < height; y++) {
    scanlines[dstOffset++] = 0; // Filter: None
    buffer.copy(scanlines, dstOffset, srcOffset, srcOffset + width * 4);
    dstOffset += width * 4;
    srcOffset += width * 4;
  }

  const compressedData = zlib.deflateSync(scanlines);

  // PNG Signature
  const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  // IDAT
  const idat = makeChunk('IDAT', compressedData);

  // IEND
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([pngSig, ihdr, idat, iend]);
}

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crcTarget = chunk.subarray(4, 8 + len);
  const crcVal = crc32(crcTarget);
  chunk.writeUInt32BE(crcVal, 8 + len);
  return chunk;
}

if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

fs.writeFileSync('public/pwa-192x192.png', createPNG(192, 192, false));
fs.writeFileSync('public/pwa-512x512.png', createPNG(512, 512, false));
fs.writeFileSync('public/pwa-maskable-512x512.png', createPNG(512, 512, true));
fs.writeFileSync('public/apple-touch-icon.png', createPNG(180, 180, true));
console.log('Successfully generated PWA icon PNGs in /public');
