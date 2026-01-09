// Node.js 脚本：生成扩展图标
// 使用方法：node generate-icons.js

const fs = require('fs');
const path = require('path');

// 创建 Canvas（Node.js 环境需要安装 canvas 包）
// 如果没有安装，可以运行：npm install canvas

let Canvas;
try {
  Canvas = require('canvas');
} catch (e) {
  console.error('❌ 错误：未找到 canvas 模块');
  console.log('📦 请先安装依赖：npm install canvas');
  console.log('或者在浏览器中打开 generate-icons.html 手动生成图标');
  process.exit(1);
}

const { createCanvas } = Canvas;

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // 渐变背景
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // 绘制简化的图表图标
  ctx.strokeStyle = 'white';
  ctx.fillStyle = 'white';
  ctx.lineWidth = Math.max(1, size / 32);

  const padding = size * 0.2;
  const chartWidth = size - padding * 2;
  const chartHeight = size - padding * 2;

  // 绘制三个柱状图
  const barWidth = chartWidth / 5;
  const bars = [0.6, 0.8, 0.5];

  bars.forEach((height, i) => {
    const x = padding + (i * 2) * barWidth;
    const barHeight = chartHeight * height;
    const y = padding + chartHeight - barHeight;

    ctx.fillRect(x, y, barWidth * 0.8, barHeight);
  });

  return canvas;
}

function generateIcons() {
  const iconsDir = path.join(__dirname, 'icons');

  // 确保 icons 目录存在
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir);
  }

  const sizes = [16, 48, 128];

  console.log('🎨 开始生成图标...\n');

  sizes.forEach(size => {
    const canvas = drawIcon(size);
    const buffer = canvas.toBuffer('image/png');
    const filename = `icon${size}.png`;
    const filepath = path.join(iconsDir, filename);

    fs.writeFileSync(filepath, buffer);
    console.log(`✅ 已生成: ${filename} (${size}x${size})`);
  });

  console.log('\n🎉 所有图标生成完成！');
  console.log('📁 图标已保存到: ' + iconsDir);
}

generateIcons();
