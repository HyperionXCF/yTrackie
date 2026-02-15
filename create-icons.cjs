const sharp = require('sharp');
const fs = require('fs');

const sizes = [16, 48, 128];

const createIcon = async (size) => {
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="${size/5}" fill="#ff0000"/>
    <path d="M${size/4} ${size/2.5} L${size*0.7} ${size/2} L${size/4} ${size*1.6}" fill="white"/>
  </svg>`;
  
  await sharp(Buffer.from(svg))
    .png()
    .toFile(`public/icon${size}.png`);
  
  console.log(`Created icon${size}.png`);
};

sizes.forEach(size => createIcon(size));
